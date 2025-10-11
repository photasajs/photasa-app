import isVideo from "is-video";
import isImage from "is-image";
import { ensureDir, exists, remove, readFile, access } from "fs-extra";
import * as fs from "fs";
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
    createGenericFallbackThumbnail,
    isBufferSizeWithinTolerance,
    processAdjustedBuffer,
    convertRgbToRgba,
} from "./thumbnail-utils";
import type { VideoSize } from "@common/types";
import { PhotasaLogger } from "@common/logger";
// 移除 ffmpeg-config 导入，路径将通过参数传递

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
 * 获取视频旋转角度
 * @param metadata - ffprobe元数据
 * @returns 旋转角度（0, 90, 180, 270）
 */
function getVideoRotation(metadata: any): number {
    const stream = metadata.streams?.find((s: any) => s.codec_type === "video");

    // 方法1: 从stream tags中获取rotate标签（旧版本ffmpeg）
    const rotateTag = stream?.tags?.rotate;
    if (rotateTag) {
        return parseInt(rotateTag, 10) || 0;
    }

    // 方法2: 从side_data中获取rotation（新版本ffmpeg）
    const sideData = stream?.side_data_list;
    if (sideData && Array.isArray(sideData)) {
        const displayMatrix = sideData.find(
            (data: any) => data.side_data_type === "Display Matrix",
        );
        if (displayMatrix && displayMatrix.rotation) {
            // rotation可能是负数，需要转换为0-360度
            let rotation = parseFloat(displayMatrix.rotation);
            rotation = ((rotation % 360) + 360) % 360;
            return rotation;
        }
    }

    // 方法3: 从format tags中获取rotate标签（某些容器格式）
    const formatRotate = metadata.format?.tags?.rotate;
    if (formatRotate) {
        return parseInt(formatRotate, 10) || 0;
    }

    return 0;
}

/**
 * 获取视频维度（考虑旋转）
 * @param video - 视频路径
 * @returns 视频维度和旋转角度
 */
function getVideoDimension(
    video: string,
    ffmpegPath?: string,
    ffprobePath?: string,
): Promise<{ dimension: VideoSize; rotation: number }> {
    // 如果提供了路径，则配置 FFmpeg
    if (ffmpegPath && ffprobePath) {
        ffmpeg.setFfmpegPath(ffmpegPath);
        ffmpeg.setFfprobePath(ffprobePath);
    }

    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(video, (err, metadata) => {
            if (err) return reject(err);

            const stream = metadata.streams.find((stream) => stream.codec_type === "video");
            const rotation = getVideoRotation(metadata);

            const darString = stream?.display_aspect_ratio;

            let width = stream?.width ?? 100;
            let height = stream?.height ?? 100;

            // ffprobe returns aspect ratios of "0:1" or `undefined` if they're not specified.
            // https://trac.ffmpeg.org/ticket/3798
            if (darString && darString !== "0:1" && darString !== "N/A") {
                // The DAR is specified so use it directly
                const [widthRatioPart, heightRatioPart] = ratioStringToParts(darString);
                const inverseDar = heightRatioPart / widthRatioPart;
                height = width * inverseDar;
            }

            // 如果视频旋转了90度或270度，需要交换宽高
            if (rotation === 90 || rotation === 270) {
                [width, height] = [height, width];
            }

            resolve({
                dimension: { width, height },
                rotation,
            });
        });
    });
}

/**
 * 创建视频缩略图
 * @param arg - 参数
 * @param logger - 日志记录器
 * @returns 缩略图路径
 */
async function createScreenshot(
    arg: ThumbnailRequest,
    logger: PhotasaLogger,
    ffmpegPath?: string,
    ffprobePath?: string,
): Promise<string> {
    logger.info("[thumbnail-handler] Create Screenshot for : " + arg.path);
    const { dimension, rotation } = await getVideoDimension(arg.path, ffmpegPath, ffprobePath);

    logger.info(
        `[thumbnail-handler] Video dimension: ${dimension.width}x${dimension.height}, rotation: ${rotation}°`,
    );

    return new Promise((resolve) => {
        const size = getOptimalThumbnailResolution(dimension, arg);

        // 创建ffmpeg命令
        const ffmpegCommand = ffmpeg(arg.path);

        // 如果视频有旋转元数据，ffmpeg默认会自动应用旋转
        // 我们已经在获取维度时考虑了旋转，所以ffmpeg可以自动处理旋转

        ffmpegCommand
            .on("filenames", function (filenames) {
                logger.info("[thumbnail-handler]Generate Screenshot: " + filenames.join(", "));
            })
            .on("error", function (err) {
                logger.error(err);
                resolve(arg.thumbnail);
            })
            .on("end", function () {
                logger.info(
                    `[thumbnail-handler] Screenshot created successfully: ${arg.thumbnail}`,
                );
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
    ffmpegPath?: string,
    ffprobePath?: string,
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

        // 确保目标文件可写：如果文件存在且不可写，先删除它
        try {
            if (await exists(arg.thumbnail)) {
                // 检查文件是否可写
                try {
                    await access(arg.thumbnail, fs.constants.W_OK);
                    logger.debug(
                        `[thumbnail-handler] Target thumbnail exists and is writable: ${arg.thumbnail}`,
                    );
                } catch (writeError) {
                    logger.warn(
                        `[thumbnail-handler] Target thumbnail exists but is not writable, removing: ${arg.thumbnail}`,
                    );
                    await remove(arg.thumbnail);
                }
            }
        } catch (cleanupError) {
            logger.warn(`[thumbnail-handler] Failed to cleanup target thumbnail: ${cleanupError}`);
            // 继续尝试写入，让后续的错误处理来处理
        }

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
            await createScreenshot(arg, logger, ffmpegPath, ffprobePath);
        } else if (isImage(arg.path) || isHeic) {
            // 创建图片缩略图 如果文件是 HEIC 格式，则使用预览图片
            const target = isHeic ? arg.preview : arg.path;
            try {
                // 确保width和height是数字类型
                const width = Number(arg.width);
                const height = Number(arg.height);

                // 验证类型转换
                if (isNaN(width) || isNaN(height)) {
                    throw new Error(
                        `Invalid dimensions: width=${arg.width} (${typeof arg.width}), height=${arg.height} (${typeof arg.height})`,
                    );
                }

                logger.debug(
                    `[thumbnail-handler] Processing image with dimensions: ${width}x${height} (${typeof width}x${typeof height})`,
                );

                // 创建图片缩略图
                await sharp(target)
                    .rotate() // 旋转图片 根据 EXIF 信息旋转
                    .resize(width, height, {
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
            } catch (error) {
                logger.warn(
                    `[thumbnail-handler] Failed to process image with sharp, creating fallback: ${error}`,
                );
                // 如果图片处理失败，创建通用占位符
                const fallbackPath = await createGenericFallbackThumbnail(arg, logger);
                if (!fallbackPath) {
                    throw error; // 如果连占位符都创建失败，抛出原始错误
                }
            }
        } else {
            // 处理不支持的文件类型 - 创建通用占位符缩略图
            logger.info(
                `[thumbnail-handler] Creating generic placeholder thumbnail for unsupported file: ${arg.path}`,
            );
            const fallbackPath = await createGenericFallbackThumbnail(arg, logger);
            if (!fallbackPath) {
                logger.error(
                    `[thumbnail-handler] Failed to create placeholder thumbnail for: ${arg.path}`,
                );
                // 不抛出错误，让函数正常返回，因为这是不支持的文件类型
            }
        }
    } catch (e) {
        logger.error(
            "[thumbnail-handler] Failed to create thumbnail: " + arg.path + " due to: " + e,
        );
    }
    return arg;
}
