import isVideo from "is-video";
import { ensureDir, exists, remove, readFile } from "fs-extra";
import sharp from "sharp";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import type { ThumbnailRequest } from "@common/thumbnail-types";
import { toPreviewPath } from "@shared/path-util";
import { getOptimalThumbnailResolution, HeicExtensionRE, ratioStringToParts } from "@common/utils";
import { initializeHeifModule, resetHeifModule } from "../wasm/heif-module";
import {
    calculateAdjustedDimensions,
    createFallbackThumbnail,
    isBufferSizeWithinTolerance,
    processAdjustedBuffer,
    convertRgbToRgba,
} from "./thumbnail-utils";
import type { VideoSize } from "@common/types";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { PhotasaLogger } from "@common/logger";

// Get the paths to the packaged versions of the binaries we want to use
const ffmpegPath = (ffmpegStatic as string).replace("app.asar", "app.asar.unpacked");
const ffprobePath = ffprobeStatic.path.replace("app.asar", "app.asar.unpacked");

// Tell the ffmpeg package where it can find the needed binaries.
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * 使用 wasm-heif 解码 HEIC/HEIF 文件
 * 改进版本：增强错误处理和稳定性
 * @param arg - 参数
 * @param logger - 日志记录器
 * @returns 预览图片路径
 */
async function createPreviewImage(arg: ThumbnailRequest, logger: PhotasaLogger): Promise<string> {
    logger.info("[thumbnail-handler] Create Preview Image for : " + arg.path);
    const previewName = toPreviewPath(arg.path);
    let inputBuffer: Buffer;
    let heifModule: any = null;

    try {
        inputBuffer = await readFile(arg.path);
    } catch (readError) {
        logger.error(`[thumbnail-handler] Failed to read HEIC file ${arg.path}: ${readError}`);
        throw new Error(`Failed to read HEIC file: ${readError}`);
    }

    try {
        logger.info("[thumbnail-handler] Decode HEIC/HEIF for : " + arg.path);

        // 复用导入侧的 HEIF 模块初始化（带缓存）
        heifModule = await initializeHeifModule();

        // 验证模块是否有效
        if (
            !heifModule ||
            typeof heifModule.decode !== "function" ||
            typeof heifModule.dimensions !== "function"
        ) {
            throw new Error("Invalid WASM module - missing required functions");
        }

        // 安全解码 HEIC/HEIF 文件，包装在try-catch中处理WASM错误
        let decoded: Uint8Array;
        try {
            // 某些HEIC文件可能导致WASM内存越界，尝试使用不同的解码参数
            decoded = heifModule.decode(inputBuffer, inputBuffer.byteLength, false) as Uint8Array;
        } catch (decodeError: any) {
            // 如果是内存访问错误，尝试使用更小的缓冲区或其他策略
            if (decodeError?.message?.includes("memory access out of bounds")) {
                logger.warn(
                    "[thumbnail-handler] WASM memory access error, trying alternative decode",
                );

                // 尝试重新初始化模块
                resetHeifModule();
                heifModule = await initializeHeifModule();

                // 尝试使用较小的缓冲区
                const maxSize = 1024 * 1024 * 10; // 10MB limit
                if (inputBuffer.byteLength > maxSize) {
                    logger.warn(
                        `[thumbnail-handler] File too large (${inputBuffer.byteLength} bytes), skipping HEIC decode`,
                    );
                    throw new Error("HEIC file too large for WASM decoder");
                }

                // 再次尝试解码
                try {
                    decoded = heifModule.decode(
                        inputBuffer,
                        inputBuffer.byteLength,
                        true,
                    ) as Uint8Array;
                } catch (retryError) {
                    logger.error("[thumbnail-handler] HEIC decode retry failed:", retryError);
                    throw new Error(`HEIC decode failed after retry: ${retryError}`);
                }
            } else {
                throw decodeError;
            }
        }

        // 检查解码结果
        if (!decoded || (typeof decoded === "object" && (decoded as any).error)) {
            const errorMsg =
                typeof decoded === "object" ? (decoded as any).error : "Unknown decode error";
            throw new Error(`WASM decode failed: ${errorMsg}`);
        }

        // 类型断言为解码成功对象
        const dimensions = heifModule.dimensions();
        if (
            !dimensions ||
            typeof dimensions.width !== "number" ||
            typeof dimensions.height !== "number"
        ) {
            throw new Error("Invalid dimensions returned from WASM module");
        }

        const { width, height, channels } = dimensions;
        logger.info(`[wasm-heif] Decoded width=${width}, height=${height}, channels=${channels}`);

        // 自动检测实际的通道数
        let actualChannels = channels;
        const decodedSize = decoded.length;
        const pixelCount = width * height;

        // 如果buffer大小不匹配声明的通道数，尝试推断实际通道数
        if (decodedSize === pixelCount * 4 && channels === 3) {
            logger.info(
                `[wasm-heif] Buffer size suggests 4 channels (RGBA) despite dimensions reporting ${channels}`,
            );
            actualChannels = 4;
        } else if (decodedSize === pixelCount * 3 && channels === 4) {
            logger.info(
                `[wasm-heif] Buffer size suggests 3 channels (RGB) despite dimensions reporting ${channels}`,
            );
            actualChannels = 3;
        }

        // 检查 buffer 长度 - 使用实际通道数
        const expectedSize = width * height * actualChannels;
        const { isWithin, difference, tolerance } = isBufferSizeWithinTolerance(
            decoded.length,
            expectedSize,
        );

        if (!isWithin) {
            logger.error(
                `[wasm-heif] Buffer size mismatch exceeds tolerance: expect ${width}*${height}*${actualChannels}=${expectedSize}, got ${decoded.length}, difference: ${difference} bytes (tolerance: ${tolerance} bytes)`,
            );

            // 尝试调整尺寸以适应实际缓冲区大小
            const adjustedDimensions = calculateAdjustedDimensions(decoded, width, actualChannels);
            if (adjustedDimensions) {
                logger.info(`[wasm-heif] Adjusting dimensions to match buffer size`);
                return await processAdjustedBuffer(
                    decoded,
                    adjustedDimensions,
                    previewName,
                    logger,
                );
            }

            throw new Error(
                `[wasm-heif] Buffer size mismatch exceeds tolerance: expect ${expectedSize}, got ${decoded.length}`,
            );
        } else if (difference > 0) {
            logger.warn(
                `[wasm-heif] Buffer size mismatch within tolerance: expect ${width}*${height}*${actualChannels}=${expectedSize}, got ${decoded.length}, difference: ${difference} bytes (within tolerance: ${tolerance} bytes)`,
            );
        }
        // 若 actualChannels 不是 4，补齐为 RGBA
        let rgbaBuffer: Buffer;
        if (actualChannels === 4) {
            rgbaBuffer = Buffer.from(decoded);
            logger.info(`[wasm-heif] Using RGBA buffer directly, length=${rgbaBuffer.length}`);
        } else if (actualChannels === 3) {
            rgbaBuffer = convertRgbToRgba(decoded, width, height);
            logger.info(`[wasm-heif] RGB buffer补齐为RGBA, new length=${rgbaBuffer.length}`);
        } else {
            logger.error(`[wasm-heif] Unsupported channels: ${actualChannels}`);
            throw new Error(`[wasm-heif] Unsupported channels: ${actualChannels}`);
        }

        // 用 sharp 生成 JPEG 预览
        await sharp(rgbaBuffer, {
            raw: { width, height, channels: 4 },
        })
            .toFormat("jpeg")
            .toFile(previewName);

        return previewName;
    } catch (e) {
        logger.error("[thumbnail-handler] HEIC/HEIF decode error:", e);

        // 最终回退方案：创建占位符缩略图
        try {
            logger.info("[thumbnail-handler] Creating fallback thumbnail for HEIC file");
            const fallbackPath = await createFallbackThumbnail(arg, logger);
            if (fallbackPath) {
                logger.info("[thumbnail-handler] Fallback thumbnail created successfully");
                return fallbackPath;
            }
        } catch (fallbackError) {
            logger.warn("[thumbnail-handler] All fallback solutions failed:", fallbackError);
        }

        throw e;
    } finally {
        // 清理资源
        if (heifModule && typeof heifModule.free === "function") {
            try {
                heifModule.free();
            } catch (freeError) {
                logger.warn(`[thumbnail-handler] Failed to free WASM module: ${freeError}`);
            }
        }
    }
}

/**
 * 删除缩略图
 * @param arg - 参数
 * @param logger - 日志记录器
 * @returns 缩略图路径
 */
export async function removeThumbnail(
    arg: ThumbnailRequest,
    logger: PhotasaLogger,
): Promise<ThumbnailRequest> {
    const isExist = await exists(arg.thumbnail);
    if (!isExist) {
        return arg;
    }

    try {
        await remove(arg.thumbnail);
        logger.info("[thumbnail-handler] Delete thumbnail for : " + arg.thumbnail + " success");
    } catch (e) {
        logger.error(
            "[thumbnail-handler] Failed to delete thumbnail: " + arg.thumbnail + " due to: " + e,
        );
    }

    return arg;
}

/**
 * 获取视频维度
 * @param video - 视频路径
 * @returns 视频维度
 */
function getVideoDimension(video: string): Promise<VideoSize> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(video, (err, metadata) => {
            if (err) return reject(err);

            const stream = metadata.streams.find((stream) => stream.codec_type === "video");

            const darString = stream?.display_aspect_ratio;

            // ffprobe returns aspect ratios of "0:1" or `undefined` if they're not specified.
            // https://trac.ffmpeg.org/ticket/3798
            if (darString && darString !== "0:1" && darString !== "N/A") {
                // The DAR is specified so use it directly
                const [widthRatioPart, heightRatioPart] = ratioStringToParts(darString);
                const inverseDar = heightRatioPart / widthRatioPart;
                resolve({
                    width: stream.width,
                    height: stream.width * inverseDar,
                });
            } else {
                // DAR not specified so assume square pixels (use sample resolution as-is).
                resolve({
                    width: stream?.width ?? 100,
                    height: stream?.height ?? 100,
                });
            }
        });
    });
}

/**
 * 创建视频缩略图
 * @param arg - 参数
 * @param logger - 日志记录器
 * @returns 缩略图路径
 */
async function createScreenshot(arg: ThumbnailRequest, logger: PhotasaLogger): Promise<string> {
    logger.info("[thumbnail-handler] Create Screenshot for : " + arg.path);
    const dimension = await getVideoDimension(arg.path);
    return new Promise((resolve) => {
        const size = getOptimalThumbnailResolution(dimension, arg);
        ffmpeg(arg.path)
            .on("filenames", function (filenames) {
                logger.info("[thumbnail-handler]Generate Screenshot: " + filenames.join(", "));
            })
            .on("error", function (err) {
                logger.error(err);
                resolve(arg.thumbnail);
            })
            .on("end", function () {
                resolve(arg.thumbnail);
            })
            .screenshots({
                timestamps: ["1%"],
                filename: path.basename(arg.thumbnail),
                folder: path.dirname(arg.thumbnail),
                size: `${size.width}x${size.height}`,
            });
    });
}

/**
 * 创建缩略图
 * @param arg - 参数
 * @param logger - 日志记录器
 * @returns 缩略图路径
 */
export async function createThumbnail(
    arg: ThumbnailRequest,
    logger: PhotasaLogger,
): Promise<ThumbnailRequest> {
    logger.info("[thumbnail-handler] Create Thumbnail for : " + arg.path);
    try {
        // 检查源文件是否存在
        const sourceExists = await exists(arg.path);
        if (!sourceExists) {
            logger.error(`[thumbnail-handler] Source file does not exist: ${arg.path}`);
            return arg;
        }
        if (!arg.always) {
            // 检查缩略图是否存在 如果存在，则不创建
            const thumbnailExists = await exists(arg.thumbnail);
            if (thumbnailExists) {
                logger.info(`[thumbnail-handler]Thumbnail already exists: ${arg.thumbnail}`);
                return arg;
            }
        }

        // 确保缩略图目录存在
        await ensureDir(path.dirname(arg.thumbnail));

        let isHeic = HeicExtensionRE.test(arg.path);
        // 如果文件是 HEIC 格式，则需要先转换为 PNG 格式
        if (isHeic) {
            arg.preview = await createPreviewImage(arg, logger);
            // 如果预览图片创建成功，则认为文件是 HEIC 格式
            isHeic = arg.preview !== "";
        }

        if (isVideo(arg.path)) {
            logger.info("[thumbnail-handler] Create video thumbnail for : " + arg.path);
            // 创建视频缩略图
            await createScreenshot(arg, logger);
        } else {
            // 创建图片缩略图 如果文件是 HEIC 格式，则使用预览图片
            const target = isHeic ? arg.preview : arg.path;
            // 创建图片缩略图
            await sharp(target)
                .rotate() // 旋转图片 根据 EXIF 信息旋转
                .resize(arg.width, arg.height, {
                    fit: sharp.fit.inside,
                    background: "white",
                    withoutEnlargement: arg.withoutEnlargement,
                })
                .toFormat("png") // 将图片转换为 PNG 格式
                .toFile(arg.thumbnail) // 将图片保存到指定路径
                .then(() => {
                    // 打印图片信息
                    logger.info(
                        `[thumbnail-handler] Create image thumbnail for : ${arg.path} success`,
                    );
                });
        }
    } catch (e) {
        logger.error(
            "[thumbnail-handler] Failed to create thumbnail: " + arg.path + " due to: " + e,
        );
    }
    return arg;
}
