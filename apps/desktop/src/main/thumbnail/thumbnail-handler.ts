import isVideo from "is-video";
import isImage from "is-image";
import { ensureDir, exists, remove } from "fs-extra";
import { ensureAccess } from "./utils";
import path from "path";
import type { ThumbnailRequest } from "@photasa/common";
import { toPreviewPath } from "@shared/path-util";
import { HeicExtensionRE } from "@photasa/common";
import { PhotasaLogger } from "@photasa/common";
import { MaLiang } from "@maliang/core/MaLiang";
import { BmpBrush } from "@maliang/brushes/image/BmpBrush";
import { SharpBrush } from "@maliang/brushes/image/SharpBrush";
import { FfmpegBrush } from "@maliang/brushes/video/FfmpegBrush";
import { HeicBrush } from "@maliang/brushes/heif/HeicBrush";
import { FallbackBrush } from "../../engines/maliang/brushes/generic/FallbackBrush";
import type { PaintRequest } from "@maliang/types/BrushTypes";
// 移除 ffmpeg-config 导入，路径将通过参数传递

/**
 * MaLiang  引擎实例 - 延迟初始化
 */
let maLiangInstance: MaLiang | null = null;

/**
 * 获取 MaLiang  引擎实例
 * @param logger - 日志记录器
 * @returns MaLiang  引擎实例
 */
function getMaLiangInstance(logger: PhotasaLogger): MaLiang {
    if (!maLiangInstance) {
        logger.info("[thumbnail-handler] Initializing MaLiang  engine...");

        maLiangInstance = new MaLiang(
            {
                debug: false,
                cache: {
                    enabled: false,
                    maxSize: 0,
                    ttl: 0,
                    strategy: "lru",
                }, // Worker环境不使用缓存
                performance: {
                    enableMonitoring: true,
                    logSlowOperations: false,
                    slowOperationThreshold: 30000,
                },
            },
            logger,
        );

        // 注册神笔
        maLiangInstance.registerBrush(new BmpBrush());
        maLiangInstance.registerBrush(new SharpBrush());
        maLiangInstance.registerBrush(new HeicBrush());
        maLiangInstance.registerBrush(new FfmpegBrush());

        // 注册回退神笔（最低优先级）
        maLiangInstance.registerBrush(new FallbackBrush());

        logger.info(
            "[thumbnail-handler] MaLiang engine initialized with BmpBrush, SharpBrush, HeicBrush, FfmpegBrush, and FallbackBrush",
        );
    }
    return maLiangInstance;
}

/**
 * 判断是否使用 MaLiang  处理
 * @param filePath - 文件路径
 * @returns 是否使用 MaLiang
 */
function shouldUseMaLiang(filePath: string): boolean {
    // MaLiang引擎处理所有图像和视频格式（包括HEIC，现在有HeicBrush支持）

    // HEIC格式现在通过HeicBrush处理
    if (HeicExtensionRE.test(filePath)) return true;

    // 图像格式通过MaLiang处理
    if (isImage(filePath)) return true;

    // 视频格式通过MaLiang处理
    if (isVideo(filePath)) return true;

    return false;
}

/*
 * REMOVED: createPreviewImage function
 *
 * 此函数已被MaLiang引擎的HeicBrush完全替代
 * HeicBrush实现了一次WASM解码同时生成预览图和缩略图，性能更优
 *
 * 原函数功能现在通过以下方式实现：
 * - HeicBrush.createMiniature() 支持 generatePreview 选项
 * - 一次解码生成多种输出，避免重复WASM调用
 */

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

/**
 * 获取视频维度（考虑旋转）
 * @param video - 视频路径
 * @returns 视频维度和旋转角度
 */

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

        // 确保缩略图可写
        await ensureAccess(arg.thumbnail, logger);

        const isHeic = HeicExtensionRE.test(arg.path);

        // 判断是否使用 MaLiang Engine 处理（包括 HEIC 格式）
        if (shouldUseMaLiang(arg.path)) {
            try {
                logger.info("[thumbnail-handler] Processing with MaLiang : " + arg.path);
                const maLiang = getMaLiangInstance(logger);

                const paintRequest: PaintRequest = {
                    filePath: arg.path,
                    operations: ["generateThumbnail"],
                    thumbnailOptions: {
                        width: Number(arg.width),
                        height: Number(arg.height),
                        format: "png", // 输出为 PNG 格式
                        withoutEnlargement: arg.withoutEnlargement,
                        outputPath: arg.thumbnail,

                        // HEIC特有选项：同时生成预览图
                        ...(isHeic && {
                            generatePreview: true,
                            previewPath: toPreviewPath(arg.path),
                            previewFormat: "jpeg",
                            previewQuality: 90,
                        }),
                    },
                    outputPath: arg.thumbnail,
                };

                const result = await maLiang.paint(paintRequest);

                if (result.success) {
                    logger.info(`[thumbnail-handler] MaLiang processed successfully: ${arg.path}`);

                    // 对于 HEIC 文件，设置预览图路径
                    if (isHeic) {
                        arg.preview = toPreviewPath(arg.path);
                        logger.info(
                            `[thumbnail-handler] HEIC preview image created at: ${arg.preview}`,
                        );
                    }

                    return arg;
                } else {
                    throw new Error(
                        `MaLiang processing failed: ${result.error?.message || "Unknown error"}`,
                    );
                }
            } catch (maLiangError) {
                logger.warn(
                    `[thumbnail-handler] MaLiang failed, falling back to legacy processing: ${maLiangError}`,
                );
            }
        } else {
            // 处理不支持的文件类型 - 通过MaLiang使用FallbackBrush
            logger.info(
                `[thumbnail-handler] Creating placeholder thumbnail with FallbackBrush for: ${arg.path}`,
            );
            const maLiang = getMaLiangInstance(logger);
            const fallbackRequest: PaintRequest = {
                filePath: arg.path,
                operations: ["generateThumbnail"],
                thumbnailOptions: {
                    width: Number(arg.width),
                    height: Number(arg.height),
                    format: "jpeg",
                    outputPath: arg.thumbnail,
                },
            };

            const fallbackResult = await maLiang.paint(fallbackRequest);
            if (!fallbackResult.success) {
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
