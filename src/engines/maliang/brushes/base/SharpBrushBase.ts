/**
 * SharpBrushBase - Sharp神笔家族基类
 * 基于Sharp库的图像处理神笔基类，提供通用的图像处理能力
 *
 * Sharp是一个高性能的Node.js图像处理库，支持多种格式的读取、处理和输出
 * 特别适合处理JPEG、PNG、WebP、TIFF、AVIF等现代图像格式
 *
 * @author MaLiang Engine Team
 * @since 1.0.0
 */

import sharp, { Sharp } from "sharp";
import { ensureDir, exists } from "fs-extra";
import path from "path";
import type { PhotasaLogger } from "@common/logger";
import { BaseMagicBrush } from "../../core/MagicBrush";
import type { ThumbnailOptions, Metadata, EditOperation } from "../../types/BrushTypes";
import type {
    FilterParams,
    AdjustParams,
    EffectParams,
    GeometryParams,
} from "../../types/EditTypes";

/**
 * Sharp处理选项
 * 定义Sharp库的通用处理参数
 */
export interface SharpProcessingOptions {
    /** 是否保留EXIF元数据 */
    withMetadata?: boolean;
    /** 输出质量 (1-100) */
    quality?: number;
    /** 是否渐进式JPEG */
    progressive?: boolean;
    /** 是否优化输出 */
    optimize?: boolean;
    /** 背景颜色 */
    background?: string | { r: number; g: number; b: number; alpha?: number };
}

/**
 * Sharp错误类型
 * 用于标识Sharp处理过程中的不同错误类型
 */
export enum SharpErrorType {
    /** 文件不存在或无法读取 */
    FILE_NOT_ACCESSIBLE = "FILE_NOT_ACCESSIBLE",
    /** 不支持的图像格式 */
    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
    /** 图像数据损坏 */
    CORRUPTED_IMAGE = "CORRUPTED_IMAGE",
    /** 内存不足 */
    OUT_OF_MEMORY = "OUT_OF_MEMORY",
    /** 处理参数无效 */
    INVALID_PARAMETERS = "INVALID_PARAMETERS",
    /** 输出路径无效 */
    INVALID_OUTPUT_PATH = "INVALID_OUTPUT_PATH",
    /** 处理超时 */
    PROCESSING_TIMEOUT = "PROCESSING_TIMEOUT",
    /** 未知错误 */
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Sharp处理错误类
 * 封装Sharp处理过程中的错误信息，提供详细的错误类型和上下文
 */
export class SharpProcessingError extends Error {
    public readonly type: SharpErrorType;
    public readonly originalError?: Error;
    public readonly context?: Record<string, any>;

    constructor(
        type: SharpErrorType,
        message: string,
        originalError?: Error,
        context?: Record<string, any>,
    ) {
        super(message);
        this.name = "SharpProcessingError";
        this.type = type;
        this.originalError = originalError;
        this.context = context;
    }

    /**
     * 创建文件访问错误
     */
    static fileNotAccessible(filePath: string, originalError?: Error): SharpProcessingError {
        return new SharpProcessingError(
            SharpErrorType.FILE_NOT_ACCESSIBLE,
            `Cannot access file: ${filePath}`,
            originalError,
            { filePath },
        );
    }

    /**
     * 创建格式不支持错误
     */
    static unsupportedFormat(filePath: string, detectedFormat?: string): SharpProcessingError {
        return new SharpProcessingError(
            SharpErrorType.UNSUPPORTED_FORMAT,
            `Unsupported format for file: ${filePath}${detectedFormat ? ` (detected: ${detectedFormat})` : ""}`,
            undefined,
            { filePath, detectedFormat },
        );
    }

    /**
     * 创建图像损坏错误
     */
    static corruptedImage(filePath: string, originalError?: Error): SharpProcessingError {
        return new SharpProcessingError(
            SharpErrorType.CORRUPTED_IMAGE,
            `Corrupted or invalid image: ${filePath}`,
            originalError,
            { filePath },
        );
    }
}

/**
 * Sharp神笔家族基类
 *
 * 这个基类为所有基于Sharp库的神笔提供了统一的基础功能：
 * 1. 图像文件的读取和验证
 * 2. 元数据提取（EXIF、ICC等）
 * 3. 缩略图生成（支持多种缩放策略）
 * 4. 基础图像编辑（滤镜、调整、几何变换等）
 * 5. 多格式输出（JPEG、PNG、WebP、TIFF等）
 * 6. 错误处理和性能优化
 *
 * 子类只需要：
 * 1. 定义支持的格式列表
 * 2. 实现格式特定的处理逻辑（如果需要）
 * 3. 可选择覆盖基类方法以提供特殊处理
 */
export abstract class SharpBrushBase extends BaseMagicBrush {
    /** Sharp处理的默认选项 */
    protected readonly defaultOptions: SharpProcessingOptions = {
        withMetadata: true,
        quality: 90,
        progressive: true,
        optimize: true,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
    };

    /** 支持的输出格式映射 */
    protected readonly outputFormats = {
        jpeg: "jpeg",
        jpg: "jpeg",
        png: "png",
        webp: "webp",
        tiff: "tiff",
        tif: "tiff",
        avif: "avif",
    } as const;

    constructor(priority = 50) {
        super(priority);
    }

    /**
     * 提取精华（元数据提取）
     *
     * 使用Sharp库提取图像的详细元数据，包括：
     * - 基础信息：尺寸、格式、颜色空间、密度等
     * - EXIF数据：拍摄参数、GPS信息、设备信息等
     * - ICC配置文件：颜色空间信息
     * - 其他元数据：创建时间、修改时间等
     *
     * @param filePath 图像文件路径
     * @param logger 日志记录器，用于记录处理过程和错误
     * @returns Promise<Metadata | null> 提取的元数据，如果提取失败返回null
     *
     * @throws {SharpProcessingError} 当文件无法访问或处理失败时抛出
     *
     * @example
     * ```typescript
     * const brush = new JpegBrush();
     * const metadata = await brush.extractEssence('/path/to/image.jpg', logger);
     * console.log(`Image size: ${metadata.width}x${metadata.height}`);
     * console.log(`Format: ${metadata.format}`);
     * ```
     */
    public async extractEssence(filePath: string, logger: PhotasaLogger): Promise<Metadata | null> {
        try {
            logger.debug(`[${this.name}] Extracting metadata from: ${filePath}`);

            // 验证文件可访问性
            await this.validateFileAccess(filePath);

            // 创建Sharp实例并获取元数据
            const sharpInstance = sharp(filePath);
            const metadata = await sharpInstance.metadata();

            logger.debug(`[${this.name}] Metadata extracted successfully`, {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                channels: metadata.channels,
                density: metadata.density,
            });

            // 转换为标准元数据格式
            const result: Metadata = {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                channels: metadata.channels,
                density: metadata.density,
                hasProfile: metadata.hasProfile,
                hasAlpha: metadata.hasAlpha,
                space: metadata.space,
                depth: metadata.depth,
                isProgressive: metadata.isProgressive,
                orientation: metadata.orientation,

                // 计算文件大小（如果可获取）
                fileSize: await this.getFileSize(filePath),

                // EXIF数据（如果存在）
                exif: metadata.exif ? this.parseExifBuffer(metadata.exif) : undefined,

                // ICC配置文件信息
                icc: metadata.icc ? this.parseIccProfile(metadata.icc) : undefined,
            };

            return result;
        } catch (error) {
            logger.error(`[${this.name}] Failed to extract metadata from ${filePath}:`, error);

            // 根据错误类型进行分类处理
            if (error instanceof SharpProcessingError) {
                throw error;
            }

            // 分析Sharp库的错误信息
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes("Input file is missing") || errorMessage.includes("ENOENT")) {
                throw SharpProcessingError.fileNotAccessible(filePath, error as Error);
            }

            if (
                errorMessage.includes("Input file contains unsupported image format") ||
                errorMessage.includes("VipsJpeg: Invalid SOS parameters")
            ) {
                throw SharpProcessingError.unsupportedFormat(filePath);
            }

            if (
                errorMessage.includes("Input buffer contains unsupported image format") ||
                errorMessage.includes("premature end of JPEG file")
            ) {
                throw SharpProcessingError.corruptedImage(filePath, error as Error);
            }

            // 其他未知错误
            throw new SharpProcessingError(
                SharpErrorType.UNKNOWN_ERROR,
                `Failed to extract metadata: ${errorMessage}`,
                error as Error,
                { filePath },
            );
        }
    }

    /**
     * 制作微缩版（缩略图生成）
     *
     * 使用Sharp库生成高质量的缩略图，支持多种缩放策略：
     * - fit.inside: 保持宽高比，确保图像完全包含在指定尺寸内
     * - fit.outside: 保持宽高比，确保图像完全覆盖指定尺寸
     * - fit.fill: 拉伸图像以精确匹配指定尺寸
     * - fit.contain: 保持宽高比，添加背景色填充
     * - fit.cover: 保持宽高比，裁剪超出部分
     *
     * @param filePath 图像文件路径
     * @param options 缩略图生成选项
     * @param logger 日志记录器
     * @returns Promise<string> 生成的缩略图文件路径
     *
     * @throws {SharpProcessingError} 当文件处理失败时抛出
     *
     * @example
     * ```typescript
     * const brush = new PngBrush();
     * const thumbnailPath = await brush.createMiniature('/path/to/image.png', {
     *   width: 200,
     *   height: 200,
     *   quality: 80,
     *   format: 'jpeg'
     * }, logger);
     * ```
     */
    public async createMiniature(
        filePath: string,
        options: ThumbnailOptions,
        logger: PhotasaLogger,
    ): Promise<string | Buffer> {
        try {
            logger.debug(`[${this.name}] Creating thumbnail for: ${filePath}`, options);

            // 验证输入参数
            this.validateThumbnailOptions(options);
            await this.validateFileAccess(filePath);

            // 生成缩略图输出路径
            const outputPath = await this.generateThumbnailPath(filePath, options);

            // 确保输出目录存在
            await ensureDir(path.dirname(outputPath));

            // 创建Sharp处理管道
            const pipeline = sharp(filePath);

            // 应用尺寸调整
            pipeline.resize(options.width, options.height, {
                fit: options.withoutEnlargement ? "inside" : "cover",
                withoutEnlargement: options.withoutEnlargement || false,
                background: this.defaultOptions.background,
            });

            // 自动旋转（基于EXIF orientation）
            pipeline.rotate();

            // 应用输出格式和质量设置
            const outputFormat = options.format || "png";
            await this.applyOutputFormat(pipeline, outputFormat, options.quality);

            // 执行处理并保存
            await pipeline.toFile(outputPath);

            logger.info(`[${this.name}] Thumbnail created successfully: ${outputPath}`);
            return outputPath;
        } catch (error) {
            logger.error(`[${this.name}] Failed to create thumbnail for ${filePath}:`, error);

            if (error instanceof SharpProcessingError) {
                throw error;
            }

            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes("Input file is missing")) {
                throw SharpProcessingError.fileNotAccessible(filePath, error as Error);
            }

            if (errorMessage.includes("Input file contains unsupported image format")) {
                throw SharpProcessingError.unsupportedFormat(filePath);
            }

            throw new SharpProcessingError(
                SharpErrorType.UNKNOWN_ERROR,
                `Failed to create thumbnail: ${errorMessage}`,
                error as Error,
                { filePath, options },
            );
        }
    }

    /**
     * 神笔改画（图像编辑）
     *
     * 执行一系列图像编辑操作，包括：
     * - 滤镜效果：模糊、锐化、灰度、复古等
     * - 色彩调整：亮度、对比度、饱和度、色相等
     * - 几何变换：裁剪、旋转、翻转、缩放等
     * - 特殊效果：晕影、噪点、浮雕等
     *
     * @param filePath 源图像文件路径
     * @param operations 编辑操作数组，按顺序执行
     * @param outputPath 输出文件路径
     * @param logger 日志记录器
     * @returns Promise<string> 编辑后的图像文件路径
     *
     * @throws {SharpProcessingError} 当编辑操作失败时抛出
     *
     * @example
     * ```typescript
     * const brush = new WebpBrush();
     * const editedPath = await brush.edit('/path/to/image.webp', [
     *   { type: 'adjust', params: { brightness: { value: 10 } } },
     *   { type: 'filter', params: { blur: { radius: 2 } } },
     *   { type: 'crop', params: { x: 0, y: 0, width: 800, height: 600 } }
     * ], '/path/to/edited.webp', logger);
     * ```
     */
    public async edit(
        filePath: string,
        operations: EditOperation[],
        outputPath: string,
        logger: PhotasaLogger,
    ): Promise<string> {
        try {
            logger.debug(`[${this.name}] Editing image: ${filePath}`, { operations, outputPath });

            // 验证输入
            await this.validateFileAccess(filePath);
            this.validateEditOperations(operations);
            await this.validateOutputPath(outputPath);

            // 确保输出目录存在
            await ensureDir(path.dirname(outputPath));

            // 创建Sharp处理管道
            let pipeline = sharp(filePath);

            // 按顺序应用所有编辑操作
            for (const [index, operation] of operations.entries()) {
                logger.debug(
                    `[${this.name}] Applying operation ${index + 1}/${operations.length}: ${operation.type}`,
                );
                pipeline = await this.applyEditOperation(pipeline, operation, logger);
            }

            // 保存结果
            await pipeline.toFile(outputPath);

            logger.info(`[${this.name}] Image editing completed: ${outputPath}`);
            return outputPath;
        } catch (error) {
            logger.error(`[${this.name}] Failed to edit image ${filePath}:`, error);

            if (error instanceof SharpProcessingError) {
                throw error;
            }

            throw new SharpProcessingError(
                SharpErrorType.UNKNOWN_ERROR,
                `Failed to edit image: ${error instanceof Error ? error.message : String(error)}`,
                error as Error,
                { filePath, operations, outputPath },
            );
        }
    }

    // ========== 受保护的工具方法 ==========

    /**
     * 验证文件可访问性
     * 检查文件是否存在且可读
     */
    protected async validateFileAccess(filePath: string): Promise<void> {
        try {
            const fileExists = await exists(filePath);
            if (!fileExists) {
                throw SharpProcessingError.fileNotAccessible(filePath);
            }
        } catch (error) {
            if (error instanceof SharpProcessingError) {
                throw error;
            }
            throw SharpProcessingError.fileNotAccessible(filePath, error as Error);
        }
    }

    /**
     * 验证缩略图选项
     * 确保缩略图生成选项的有效性
     */
    protected validateThumbnailOptions(options: ThumbnailOptions): void {
        if (!options.width || !options.height || options.width <= 0 || options.height <= 0) {
            throw new SharpProcessingError(
                SharpErrorType.INVALID_PARAMETERS,
                "Invalid thumbnail dimensions: width and height must be positive numbers",
                undefined,
                { options },
            );
        }

        if (options.quality !== undefined && (options.quality < 1 || options.quality > 100)) {
            throw new SharpProcessingError(
                SharpErrorType.INVALID_PARAMETERS,
                "Invalid quality: must be between 1 and 100",
                undefined,
                { options },
            );
        }
    }

    /**
     * 验证编辑操作
     * 确保编辑操作的有效性
     */
    protected validateEditOperations(operations: EditOperation[]): void {
        if (!operations || operations.length === 0) {
            throw new SharpProcessingError(
                SharpErrorType.INVALID_PARAMETERS,
                "No edit operations provided",
                undefined,
                { operations },
            );
        }

        for (const [index, operation] of operations.entries()) {
            if (!operation.type || !operation.params) {
                throw new SharpProcessingError(
                    SharpErrorType.INVALID_PARAMETERS,
                    `Invalid operation at index ${index}: missing type or params`,
                    undefined,
                    { operation, index },
                );
            }
        }
    }

    /**
     * 验证输出路径
     * 确保输出路径有效且可写
     */
    protected async validateOutputPath(outputPath: string): Promise<void> {
        if (!outputPath || typeof outputPath !== "string") {
            throw new SharpProcessingError(
                SharpErrorType.INVALID_OUTPUT_PATH,
                "Invalid output path",
                undefined,
                { outputPath },
            );
        }

        // 检查输出目录是否可创建
        const outputDir = path.dirname(outputPath);
        try {
            await ensureDir(outputDir);
        } catch (error) {
            throw new SharpProcessingError(
                SharpErrorType.INVALID_OUTPUT_PATH,
                `Cannot create output directory: ${outputDir}`,
                error as Error,
                { outputPath, outputDir },
            );
        }
    }

    /**
     * 生成缩略图输出路径
     * 基于原文件路径和选项生成缩略图路径
     */
    protected async generateThumbnailPath(
        filePath: string,
        options: ThumbnailOptions,
    ): Promise<string> {
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const name = path.basename(filePath, ext);

        const format = options.format || "png";
        const suffix = `_thumb_${options.width}x${options.height}`;

        return path.join(dir, `${name}${suffix}.${format}`);
    }

    /**
     * 应用输出格式设置
     * 根据格式和质量要求配置Sharp输出
     */
    protected async applyOutputFormat(
        pipeline: Sharp,
        format: string,
        quality?: number,
    ): Promise<void> {
        const actualQuality = quality || this.defaultOptions.quality || 90;

        switch (format.toLowerCase()) {
            case "jpeg":
            case "jpg":
                pipeline.jpeg({
                    quality: actualQuality,
                    progressive: this.defaultOptions.progressive,
                });
                break;

            case "png":
                pipeline.png({
                    quality: actualQuality,
                    progressive: this.defaultOptions.progressive,
                    compressionLevel: Math.floor((100 - actualQuality) / 10),
                });
                break;

            case "webp":
                pipeline.webp({
                    quality: actualQuality,
                    effort: 6,
                });
                break;

            case "tiff":
            case "tif":
                pipeline.tiff({
                    quality: actualQuality,
                    compression: "lzw",
                });
                break;

            case "avif":
                pipeline.avif({
                    quality: actualQuality,
                    effort: 9,
                });
                break;

            default:
                throw new SharpProcessingError(
                    SharpErrorType.UNSUPPORTED_FORMAT,
                    `Unsupported output format: ${format}`,
                    undefined,
                    { format },
                );
        }
    }

    /**
     * 应用单个编辑操作
     * 将编辑操作应用到Sharp处理管道
     */
    protected async applyEditOperation(
        pipeline: Sharp,
        operation: EditOperation,
        logger: PhotasaLogger,
    ): Promise<Sharp> {
        try {
            switch (operation.type) {
                case "filter":
                    return this.applyFilterOperation(pipeline, operation.params as FilterParams);

                case "adjust":
                    return this.applyAdjustOperation(pipeline, operation.params as AdjustParams);

                case "effect":
                    return this.applyEffectOperation(pipeline, operation.params as EffectParams);

                case "crop":
                case "resize":
                    return this.applyGeometryOperation(pipeline, operation);

                default:
                    logger.warn(`[${this.name}] Unknown operation type: ${operation.type}`);
                    return pipeline;
            }
        } catch (error) {
            throw new SharpProcessingError(
                SharpErrorType.INVALID_PARAMETERS,
                `Failed to apply ${operation.type} operation: ${error instanceof Error ? error.message : String(error)}`,
                error as Error,
                { operation },
            );
        }
    }

    /**
     * 应用滤镜操作
     */
    protected applyFilterOperation(pipeline: Sharp, params: FilterParams): Sharp {
        // 模糊滤镜
        if (params.blur) {
            pipeline.blur(params.blur.radius / 10); // Sharp的blur参数范围较小
        }

        // 锐化滤镜
        if (params.sharpen) {
            pipeline.sharpen(
                params.sharpen.amount / 50, // sigma
                2, // flat
                3, // jagged
            );
        }

        // 灰度滤镜
        if (params.grayscale) {
            pipeline.grayscale();
        }

        // 乌褐色滤镜
        if (params.sepia) {
            const intensity = params.sepia.intensity / 100;
            pipeline.tint({ r: 255 * intensity, g: 220 * intensity, b: 177 * intensity });
        }

        return pipeline;
    }

    /**
     * 应用调整操作
     */
    protected applyAdjustOperation(pipeline: Sharp, params: AdjustParams): Sharp {
        // 构建调整参数
        const modulate: any = {};

        if (params.brightness) {
            modulate.brightness = 1 + params.brightness.value / 100;
        }

        if (params.saturation) {
            modulate.saturation = 1 + params.saturation.value / 100;
        }

        if (params.hue) {
            modulate.hue = params.hue.degrees;
        }

        // 应用调整
        if (Object.keys(modulate).length > 0) {
            pipeline.modulate(modulate);
        }

        // 伽马调整
        if (params.gamma) {
            pipeline.gamma(params.gamma.value);
        }

        return pipeline;
    }

    /**
     * 应用特效操作
     */
    protected applyEffectOperation(pipeline: Sharp, params: EffectParams): Sharp {
        // 注意：Sharp的特效功能有限，这里实现基础效果
        // 更复杂的效果可能需要在子类中使用其他库实现

        if (params.noise) {
            // Sharp没有直接的噪点功能，可以通过合成实现
            // 这里先跳过，在具体子类中实现
        }

        return pipeline;
    }

    /**
     * 应用几何变换操作
     */
    protected applyGeometryOperation(pipeline: Sharp, operation: EditOperation): Sharp {
        const params = operation.params as GeometryParams;

        if (operation.type === "crop" && params.crop) {
            const { x, y, width, height } = params.crop;
            pipeline.extract({ left: x, top: y, width, height });
        }

        if (operation.type === "resize" && params.resize) {
            const { width, height, maintainAspectRatio } = params.resize;
            pipeline.resize(width, height, {
                fit: maintainAspectRatio ? "inside" : "fill",
            });
        }

        if (params.rotate) {
            pipeline.rotate(params.rotate.angle, {
                background: params.rotate.backgroundColor || this.defaultOptions.background,
            });
        }

        if (params.flip) {
            if (params.flip.horizontal) {
                pipeline.flop();
            }
            if (params.flip.vertical) {
                pipeline.flip();
            }
        }

        return pipeline;
    }

    // ========== 私有辅助方法 ==========

    /**
     * 获取文件大小
     */
    private async getFileSize(filePath: string): Promise<number | undefined> {
        try {
            const fs = await import("fs-extra");
            const stats = await fs.stat(filePath);
            return stats.size;
        } catch {
            return undefined;
        }
    }

    /**
     * 解析EXIF缓冲区
     */
    private parseExifBuffer(buffer: Buffer): Record<string, any> | undefined {
        try {
            // 这里可以使用exif-reader或其他EXIF解析库
            // 现在先返回基础信息
            return {
                raw: buffer.toString("base64").substring(0, 100) + "...",
            };
        } catch {
            return undefined;
        }
    }

    /**
     * 解析ICC配置文件
     */
    private parseIccProfile(buffer: Buffer): Record<string, any> | undefined {
        try {
            return {
                size: buffer.length,
                description: "ICC Profile",
            };
        } catch {
            return undefined;
        }
    }
}
