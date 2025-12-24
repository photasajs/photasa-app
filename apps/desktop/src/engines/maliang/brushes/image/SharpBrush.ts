/**
 * SharpBrush - Sharp通用神笔
 * 处理Sharp原生支持的所有图像格式：JPEG, PNG, WebP, TIFF, GIF, AVIF
 *
 * 这是MaLiang引擎中最重要的神笔，利用Sharp的自动格式检测能力
 * 处理绝大多数现代图像格式，无需预处理或特殊处理
 *
 * @author MaLiang Engine Team
 * @since 1.0.0
 */

import sharp from "sharp";
import { ensureDir, exists } from "fs-extra";
import path from "path";
import type { PhotasaLogger } from "@common/logger";
import type {
    ThumbnailOptions,
    Metadata,
    EditOperation,
    PaintOperation,
    BrushRegistration,
} from "../../types/BrushTypes";
import { SharpBrushBase, SharpProcessingError, SharpErrorType } from "../base/SharpBrushBase";

/**
 * SharpBrush - Sharp原生支持格式的通用神笔
 *
 * 设计理念：
 * - 利用Sharp的自动格式检测，无需格式特定处理
 * - 一个神笔处理所有Sharp支持的格式
 * - 最大化Sharp的性能和优化特性
 *
 * 支持格式：JPEG, PNG, WebP, TIFF, GIF, AVIF
 * 核心能力：extractEssence, createMiniature, transform, edit
 */
export class SharpBrush extends SharpBrushBase {
    /**
     * 神笔名称标识
     */
    public readonly name = "SharpBrush";

    /**
     * 支持的文件格式列表
     * Sharp原生支持的所有格式
     */
    public readonly supportedFormats = ["jpeg", "jpg", "png", "webp", "tiff", "tif", "gif", "avif"];

    /**
     * 神笔支持的操作能力
     */
    public readonly capabilities: PaintOperation[] = [
        "extractMetadata",
        "generateThumbnail",
        "convertFormat",
        "editImage",
    ];

    /**
     * 神笔优先级
     * 设置为较高优先级，因为Sharp处理效率最高
     */
    public readonly priority = 90;

    /**
     * 获取神笔注册信息
     */
    public getRegistration(): BrushRegistration {
        return {
            name: this.name,
            supportedFormats: this.supportedFormats,
            priority: this.priority,
            description: "Sharp通用神笔 - 处理所有Sharp原生支持的图像格式",
            capabilities: ["extractEssence", "createMiniature", "transform", "edit"],
            version: "1.0.0",
            author: "MaLiang Engine",
        };
    }

    /**
     * 提取图像精华信息（元数据）
     *
     * 利用Sharp的高效元数据提取能力，支持：
     * - 自动格式检测
     * - 完整的EXIF、ICC、XMP信息
     * - 图像尺寸、色彩空间、密度等基础信息
     *
     * @param filePath - 图像文件路径
     * @param logger - 日志记录器
     * @returns 提取的元数据信息
     */
    public async extractEssence(filePath: string, logger: PhotasaLogger): Promise<Metadata | null> {
        try {
            logger.debug(`SharpBrush开始提取元数据: ${filePath}`);

            // 验证文件存在性
            if (!(await exists(filePath))) {
                logger.error(`SharpBrush文件不存在: ${filePath}`);
                return null;
            }

            // 使用Sharp自动检测格式并提取元数据
            const sharpInstance = sharp(filePath);
            const metadata = await sharpInstance.metadata();

            // 转换为标准元数据格式
            const result: Metadata = {
                format: metadata.format || "unknown",
                width: metadata.width || 0,
                height: metadata.height || 0,
                channels: metadata.channels || 3,
                colorDepth: this.calculateColorDepth(metadata.channels, metadata.depth),
                hasAlpha: metadata.hasAlpha || false,
                density: metadata.density || 72,
                size: metadata.size || 0,
                space: metadata.space || "srgb",
                exif: metadata.exif,
                icc: metadata.icc,
                xmp: metadata.xmp,
                // Sharp自动解析的详细信息
                sharpMetadata: {
                    format: metadata.format,
                    size: metadata.size,
                    width: metadata.width,
                    height: metadata.height,
                    space: metadata.space,
                    channels: metadata.channels,
                    depth: metadata.depth,
                    density: metadata.density,
                    chromaSubsampling: metadata.chromaSubsampling,
                    isProgressive: metadata.isProgressive,
                    hasProfile: metadata.hasProfile,
                    hasAlpha: metadata.hasAlpha,
                },
            };

            logger.info(
                `SharpBrush成功提取元数据: ${filePath} (${result.format}, ${result.width}x${result.height})`,
            );
            return result;
        } catch (error) {
            logger.error(`SharpBrush提取元数据失败: ${filePath}`, error);
            throw new SharpProcessingError(
                SharpErrorType.CORRUPTED_IMAGE,
                `Sharp元数据提取失败: ${error instanceof Error ? error.message : "未知错误"}`,
                error instanceof Error ? error : undefined,
                { filePath, operation: "extractEssence" },
            );
        }
    }

    /**
     * 创建缩略图
     *
     * 利用Sharp的高性能缩略图生成能力：
     * - 自动格式优化
     * - 智能尺寸缩放
     * - 质量控制
     * - 多种输出格式支持
     *
     * @param filePath - 源图像文件路径
     * @param options - 缩略图选项
     * @param logger - 日志记录器
     * @returns 缩略图路径或Buffer
     */
    public async createMiniature(
        filePath: string,
        options: ThumbnailOptions,
        logger: PhotasaLogger,
    ): Promise<string | Buffer> {
        try {
            logger.debug(`SharpBrush开始创建缩略图: ${filePath}`);

            // 验证文件存在
            if (!(await exists(filePath))) {
                throw new SharpProcessingError(
                    SharpErrorType.FILE_NOT_ACCESSIBLE,
                    `源文件不存在: ${filePath}`,
                    undefined,
                    { filePath, operation: "createMiniature" },
                );
            }

            // 创建Sharp实例（自动检测格式）
            let sharpInstance = sharp(filePath);

            // 应用缩放
            sharpInstance = sharpInstance.resize(options.width, options.height, {
                fit: options.fit || "inside",
                withoutEnlargement: options.withoutEnlargement,
                background: options.background,
            });

            // 应用输出格式
            const outputFormat = options.format || "png";
            switch (outputFormat) {
                case "jpeg":
                case "jpg":
                    sharpInstance = sharpInstance.jpeg({
                        quality: options.quality || 85,
                        progressive: true,
                    });
                    break;
                case "png":
                    sharpInstance = sharpInstance.png({
                        quality: options.quality || 90,
                        compressionLevel: 6,
                    });
                    break;
                case "webp":
                    sharpInstance = sharpInstance.webp({
                        quality: options.quality || 85,
                    });
                    break;
                case "avif":
                    sharpInstance = sharpInstance.avif({
                        quality: options.quality || 85,
                    });
                    break;
                default:
                    sharpInstance = sharpInstance.png({ quality: 90 });
            }

            // 输出处理
            if (options.outputPath) {
                // 确保输出目录存在
                await ensureDir(path.dirname(options.outputPath));

                // 输出到文件
                await sharpInstance.toFile(options.outputPath);

                logger.info(`SharpBrush缩略图创建成功: ${filePath} -> ${options.outputPath}`);
                return options.outputPath;
            } else {
                // 返回Buffer
                const buffer = await sharpInstance.toBuffer();

                logger.info(`SharpBrush缩略图Buffer创建成功: ${filePath} (${buffer.length} bytes)`);
                return buffer;
            }
        } catch (error) {
            logger.error(`SharpBrush缩略图创建失败: ${filePath}`, error);
            throw new SharpProcessingError(
                SharpErrorType.PROCESSING_TIMEOUT,
                `Sharp缩略图创建失败: ${error instanceof Error ? error.message : "未知错误"}`,
                error instanceof Error ? error : undefined,
                { filePath, options, operation: "createMiniature" },
            );
        }
    }

    /**
     * 格式转换
     *
     * 利用Sharp的格式转换能力：
     * - 自动源格式检测
     * - 高质量格式转换
     * - 元数据保留选项
     * - 压缩优化
     *
     * @param inputPath - 输入文件路径
     * @param targetFormat - 目标格式
     * @param outputPath - 输出文件路径
     * @param logger - 日志记录器
     * @returns 输出文件路径
     */
    public async transform(
        inputPath: string,
        targetFormat: string,
        outputPath: string,
        logger: PhotasaLogger,
    ): Promise<string> {
        try {
            logger.debug(`SharpBrush开始格式转换: ${inputPath} -> ${targetFormat}`);

            // 验证输入文件
            if (!(await exists(inputPath))) {
                throw new SharpProcessingError(
                    SharpErrorType.FILE_NOT_ACCESSIBLE,
                    `源文件不存在: ${inputPath}`,
                    undefined,
                    { inputPath, targetFormat, outputPath, operation: "transform" },
                );
            }

            // 确保输出目录存在
            await ensureDir(path.dirname(outputPath));

            // 创建Sharp实例
            let sharpInstance = sharp(inputPath);

            // 应用目标格式
            switch (targetFormat.toLowerCase()) {
                case "jpeg":
                case "jpg":
                    sharpInstance = sharpInstance.jpeg({ quality: 90, progressive: true });
                    break;
                case "png":
                    sharpInstance = sharpInstance.png({ quality: 95 });
                    break;
                case "webp":
                    sharpInstance = sharpInstance.webp({ quality: 90 });
                    break;
                case "tiff":
                case "tif":
                    sharpInstance = sharpInstance.tiff({ quality: 95 });
                    break;
                case "avif":
                    sharpInstance = sharpInstance.avif({ quality: 90 });
                    break;
                default:
                    throw new SharpProcessingError(
                        SharpErrorType.UNSUPPORTED_FORMAT,
                        `不支持的目标格式: ${targetFormat}`,
                        undefined,
                        { inputPath, targetFormat, outputPath, operation: "transform" },
                    );
            }

            // 执行转换
            await sharpInstance.toFile(outputPath);

            logger.info(`SharpBrush格式转换成功: ${inputPath} -> ${outputPath} (${targetFormat})`);
            return outputPath;
        } catch (error) {
            logger.error(`SharpBrush格式转换失败: ${inputPath}`, error);

            if (error instanceof SharpProcessingError) {
                throw error;
            }

            throw new SharpProcessingError(
                SharpErrorType.UNKNOWN_ERROR,
                `Sharp格式转换失败: ${error instanceof Error ? error.message : "未知错误"}`,
                error instanceof Error ? error : undefined,
                { inputPath, targetFormat, outputPath, operation: "transform" },
            );
        }
    }

    /**
     * 图像编辑
     *
     * 利用Sharp的图像编辑能力：
     * - 滤镜效果
     * - 颜色调整
     * - 几何变换
     * - 特效处理
     *
     * @param filePath - 源文件路径
     * @param operations - 编辑操作列表
     * @param outputPath - 输出文件路径
     * @param logger - 日志记录器
     * @returns 输出文件路径
     */
    public async edit(
        filePath: string,
        operations: EditOperation[],
        outputPath: string,
        logger: PhotasaLogger,
    ): Promise<string> {
        try {
            logger.debug(`SharpBrush开始图像编辑: ${filePath}`);

            // 验证输入文件
            if (!(await exists(filePath))) {
                throw new SharpProcessingError(
                    SharpErrorType.FILE_NOT_ACCESSIBLE,
                    `源文件不存在: ${filePath}`,
                    undefined,
                    { filePath, operations, outputPath, operation: "edit" },
                );
            }

            // 确保输出目录存在
            await ensureDir(path.dirname(outputPath));

            // 创建Sharp实例
            let sharpInstance = sharp(filePath);

            // 应用编辑操作
            for (const operation of operations) {
                sharpInstance = await this.applyEditOperation(sharpInstance, operation, logger);
            }

            // 输出结果
            await sharpInstance.toFile(outputPath);

            logger.info(`SharpBrush图像编辑完成: ${filePath} -> ${outputPath}`);
            return outputPath;
        } catch (error) {
            logger.error(`SharpBrush图像编辑失败: ${filePath}`, error);

            if (error instanceof SharpProcessingError) {
                throw error;
            }

            throw new SharpProcessingError(
                SharpErrorType.UNKNOWN_ERROR,
                `Sharp图像编辑失败: ${error instanceof Error ? error.message : "未知错误"}`,
                error instanceof Error ? error : undefined,
                { filePath, operations, outputPath, operation: "edit" },
            );
        }
    }

    /**
     * 计算颜色深度
     */
    private calculateColorDepth(channels?: number, depth?: string): number {
        const channelCount = channels || 3;
        const bitDepth = depth === "uchar" ? 8 : depth === "ushort" ? 16 : 8;
        return channelCount * bitDepth;
    }

    /**
     * 神笔描述
     */
    public toString(): string {
        return `SharpBrush - Sharp通用神笔
支持格式: ${this.supportedFormats.join(", ")}
优先级: ${this.priority}
特性: Sharp自动格式检测, 高性能处理, 完整功能支持
描述: 处理所有Sharp原生支持的现代图像格式，利用Sharp的自动优化特性`;
    }
}
