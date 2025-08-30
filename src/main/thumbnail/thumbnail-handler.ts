import isVideo from "is-video";
import { ensureDir, exists, remove, readFile } from "fs-extra";
// 替换 heic-decode 为 @saschazar/wasm-heif
import createHeifModule, { HEIFModule } from "@saschazar/wasm-heif";
import sharp from "sharp";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import type { ThumbnailRequest } from "@common/thumbnail-types";
import { toPreviewPath } from "@shared/path-util";
import { HeicExtensionRE, getOptimalThumbnailResolution, ratioStringToParts } from "@common/utils";
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

        // 加载 wasm 文件路径（已拷贝到 resources 目录）
        const wasmPath = path.join(__dirname, "../../resources/wasm_heif.wasm");

        // 检查WASM文件是否存在
        if (!(await exists(wasmPath))) {
            throw new Error(`WASM file not found at: ${wasmPath}`);
        }

        const wasmBinary = await readFile(wasmPath);

        // 初始化 wasm-heif 模块，传递 wasmBinary
        heifModule = await createHeifModule({ wasmBinary } as unknown as HEIFModule);

        // 验证模块是否有效
        if (
            !heifModule ||
            typeof heifModule.decode !== "function" ||
            typeof heifModule.dimensions !== "function"
        ) {
            throw new Error("Invalid WASM module - missing required functions");
        }

        // 解码 HEIC/HEIF 文件
        const decoded = heifModule.decode(inputBuffer, inputBuffer.byteLength, false) as Uint8Array;

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

        // 检查 buffer 长度
        if (decoded.length !== width * height * channels) {
            logger.error(
                `[wasm-heif] Buffer size mismatch: expect ${width}*${height}*${channels}=${width * height * channels}, got ${decoded ? decoded.length : "unknown"}`,
            );
            throw new Error(
                `[wasm-heif] Buffer size mismatch: expect ${width}*${height}*${channels}=${width * height * channels}, got ${decoded ? decoded.length : "unknown"}`,
            );
        }
        // 若 channels 不是 4，补齐为 RGBA
        let rgbaBuffer: Buffer;
        if (channels === 4) {
            rgbaBuffer = Buffer.from(decoded);
        } else if (channels === 3) {
            // RGB -> RGBA
            rgbaBuffer = Buffer.alloc(width * height * 4);
            for (let i = 0, j = 0; i < decoded.length; i += 3, j += 4) {
                rgbaBuffer[j] = decoded[i];
                rgbaBuffer[j + 1] = decoded[i + 1];
                rgbaBuffer[j + 2] = decoded[i + 2];
                rgbaBuffer[j + 3] = 255; // alpha
            }
            logger.info(`[wasm-heif] RGB buffer补齐为RGBA, new length=${rgbaBuffer.length}`);
        } else {
            logger.error(`[wasm-heif] Unsupported channels: ${channels}`);
            throw new Error(`[wasm-heif] Unsupported channels: ${channels}`);
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
            logger.info("[thumbnail-handler] Create image thumbnail for : " + arg.path);
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
                .then((i) => {
                    // 打印图片信息
                    logger.info(
                        `[thumbnail-handler] Create image thumbnail ${i} for : ${arg.path} success`,
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
