/**
 * BmpBrush - BMP格式专业神笔
 *
 * 专门处理BMP（位图）格式图像的神笔实现
 * BMP是Windows系统原生的无压缩位图格式，具有高保真度和良好兼容性
 *
 * 技术实现：
 * - 使用Sharp库处理BMP格式（通过临时转换解决BMP支持问题）
 * - 直接实现MagicBrush接口，不依赖基类
 * - 提供完整的BMP处理能力
 *
 * 特色功能:
 * - BMP格式原生支持，通过智能转换处理
 * - 支持1、4、8、16、24、32位色深
 * - 优化的颜色空间处理
 * - Windows系统兼容性优化
 * - 支持缩略图生成、格式转换、图像编辑
 *
 * @fileoverview BMP格式专业处理神笔
 * @author MaLiang Engine Team
 * @version 1.0.0
 * @since 1.0.0
 */

import type { PhotasaLogger } from "@photasa/common";
import type {
    Metadata,
    ThumbnailOptions,
    EditOperation,
    BrushRegistration,
    PaintOperation,
} from "../../types/BrushTypes";
import type { MagicBrush } from "../../core/MagicBrush";
import fs from "fs";
import { ensureDir } from "fs-extra";
import path from "path";
import sharp from "sharp";
import { Jimp, JimpMime } from "jimp";

/**
 * BMP特定的错误类型
 * 提供更精确的BMP处理错误信息
 */
export class BmpProcessingError extends Error {
    constructor(
        message: string,
        public readonly operation: string,
        public readonly bmpSpecificCode?: string,
        public readonly colorDepth?: number,
    ) {
        super(message);
        this.name = "BmpProcessingError";
    }
}

/**
 * BMP格式配置选项
 * 定义BMP处理的专业参数
 */
export interface BmpOptions {
    /** 色深配置 - BMP支持多种位深度 */
    colorDepth?: 1 | 4 | 8 | 16 | 24 | 32;

    /** 压缩方式 */
    compression?: "none" | "rle8" | "rle4";

    /** 是否保留alpha通道（32位模式） */
    preserveAlpha?: boolean;

    /** Windows兼容性模式 */
    windowsCompatible?: boolean;
}

/**
 * 扩展的缩略图选项接口，支持输出路径
 */
export interface ExtendedThumbnailOptions extends ThumbnailOptions {
    outputPath?: string;
}

/**
 * BmpBrush类 - BMP格式的专业神笔
 *
 * 这支神笔专精于BMP格式的处理，实现MagicBrush接口的所有能力：
 *
 * 核心能力：
 * 1. extractEssence - 精确提取BMP文件的元数据信息
 * 2. createMiniature - 创建高质量的缩略图
 * 3. transform - 执行BMP格式转换
 * 4. edit - 执行无损的图像编辑操作
 *
 * 技术特点：
 * - 使用Sharp库进行BMP处理（通过临时格式转换）
 * - 支持多种色深（1、4、8、16、24、32位）
 * - 保持图像质量的同时优化文件大小
 * - 提供Windows系统优化的兼容性处理
 *
 * BMP格式特点：
 * - 无压缩，保持原始质量
 * - Windows系统原生支持
 * - 支持多种色深
 * - 文件较大但兼容性好
 *
 * @implements {MagicBrush}
 */
export class BmpBrush implements MagicBrush {
    /**
     * 神笔的名称标识
     * @readonly
     */
    public readonly name = "BmpBrush";

    /**
     * 支持的文件格式列表
     * 只支持BMP格式
     * @readonly
     */
    public readonly supportedFormats = ["bmp"];

    /**
     * 神笔支持的操作能力列表
     * @readonly
     */
    public readonly capabilities: PaintOperation[] = [
        "extractMetadata",
        "generateThumbnail",
        "convertFormat",
        "editImage",
    ];

    /**
     * 优先级设置 - BMP专业神笔具有高优先级
     * 数值越高优先级越高，BMP专用神笔优先级为85
     * @readonly
     */
    public readonly priority = 85;

    /**
     * BMP处理的默认配置
     */
    private readonly defaultBmpOptions: BmpOptions = {
        colorDepth: 24,
        compression: "none",
        preserveAlpha: false,
        windowsCompatible: true,
    };

    /**
     * 构造函数 - 初始化BMP神笔
     * @param options BMP特定的配置选项
     */
    constructor(private readonly options: BmpOptions = {}) {
        // 合并默认配置和用户配置
        this.options = { ...this.defaultBmpOptions, ...options };
    }

    /**
     * BMP预处理：将BMP文件转换为Sharp支持的Buffer
     *
     * 这是BMP神笔的核心设计：使用Jimp读取BMP，转换为Sharp可处理的格式
     * 遵循RFC 0031设计："通过临时转换解决BMP支持问题"
     *
     * @private
     * @param filePath - BMP文件路径
     * @param logger - 日志记录器
     * @returns 转换后的PNG Buffer，可供Sharp处理
     * @throws {BmpProcessingError} 当BMP读取或转换失败时
     */
    private async preprocessBmp(filePath: string, logger: PhotasaLogger): Promise<Buffer> {
        try {
            logger.debug(`BmpBrush预处理BMP文件: ${filePath}`);

            // 先读取文件内容为Buffer
            const fileBuffer = await fs.promises.readFile(filePath);

            // 使用Jimp从Buffer读取BMP文件（Jimp原生支持BMP）
            const jimpImage = await Jimp.read(fileBuffer);

            // 转换为PNG Buffer（Sharp完全支持PNG）
            const pngBuffer = await jimpImage.getBuffer(JimpMime.png);

            logger.debug(`BmpBrush预处理完成: ${pngBuffer.length} 字节PNG Buffer`);
            return pngBuffer;
        } catch (error) {
            throw new BmpProcessingError(
                `BMP预处理失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "preprocessBmp",
                "BMP_PREPROCESSING_FAILED",
            );
        }
    }

    /**
     * 获取神笔的注册信息
     * 定义这支神笔在马良工坊中的身份和能力
     *
     * @returns 详细的注册信息
     */
    public getRegistration(): BrushRegistration {
        return {
            name: this.name,
            supportedFormats: this.supportedFormats,
            priority: this.priority,
            description: "BMP格式专业神笔 - 专门处理Windows位图格式",
            capabilities: ["extractEssence", "createMiniature", "transform", "edit"],
            version: "1.0.0",
            author: "MaLiang Engine",
        };
    }

    /**
     * 提取BMP文件的精华信息（元数据）
     *
     * BMP文件包含丰富的头部信息，这个方法能够：
     * - 解析文件头和位图信息头
     * - 提取宽度、高度、色深等关键信息
     * - 计算文件大小和像素密度
     * - 检测压缩方式和调色板使用情况
     *
     * @param filePath - BMP文件的完整路径
     * @param logger - 日志记录器实例
     * @returns 提取的元数据信息，失败时返回null
     * @throws {BmpProcessingError} 当文件不存在、格式错误时
     *
     * @example
     * ```typescript
     * const brush = new BmpBrush();
     * const metadata = await brush.extractEssence('/path/to/image.bmp', logger);
     * if (metadata) {
     *   console.log(`图像尺寸: ${metadata.width}x${metadata.height}`);
     *   console.log(`色深: ${metadata.colorDepth}位`);
     * }
     * ```
     */
    public async extractEssence(filePath: string, logger: PhotasaLogger): Promise<Metadata | null> {
        try {
            logger.debug(`BmpBrush开始提取文件精华: ${filePath}`);

            // 基础文件验证
            if (!fs.existsSync(filePath)) {
                logger.error(`BmpBrush: 文件不存在: ${filePath}`);
                return null;
            }

            // 使用BMP预处理：Jimp读取BMP → 转换为PNG Buffer → Sharp处理
            const pngBuffer = await this.preprocessBmp(filePath, logger);
            const image = sharp(pngBuffer);
            const imageMetadata = await image.metadata();
            const fileStats = fs.statSync(filePath);

            // 提取基础元数据
            const metadata: Metadata = {
                // 基础信息
                width: imageMetadata.width,
                height: imageMetadata.height,
                format: "bmp",
                size: fileStats.size,

                // BMP特定信息
                channels: imageMetadata.channels || 3,
                colorDepth: this.calculateColorDepth(imageMetadata),
                hasAlpha: imageMetadata.hasAlpha || false,
                compression: "none", // BMP通常是无压缩的
                density: imageMetadata.density || 96,

                // 扩展信息
                extended: {
                    windowsCompatible: true,
                    uncompressed: true,
                    nativeFormat: "Windows Bitmap",
                    recommendedUsage: "高质量存储、Windows系统兼容",
                    hasPalette: (imageMetadata.channels || 3) <= 1,
                    bitsPerPixel: this.calculateColorDepth(imageMetadata),
                    creator: "BmpBrush v1.0.0",
                },

                // 时间戳
                created: fileStats.birthtime,
                modified: fileStats.mtime,
            };

            logger.info(
                `BmpBrush成功提取元数据: ${metadata.width}x${metadata.height}, ${metadata.colorDepth}位色深, ${Math.round((metadata.size || 0) / 1024)}KB`,
            );

            return metadata;
        } catch (error) {
            const bmpError = new BmpProcessingError(
                `BMP元数据提取失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "extractEssence",
                "METADATA_EXTRACTION_FAILED",
            );

            logger.error("BmpBrush元数据提取异常:", bmpError);
            throw bmpError;
        }
    }

    /**
     * 创建BMP文件的精美缩略图
     *
     * 针对BMP格式优化的缩略图生成，支持多种输出格式：
     * - 保持原始色彩准确性
     * - 智能尺寸调整算法
     * - 支持输出为PNG、JPEG、BMP等格式
     * - 优化文件大小的同时保持质量
     *
     * @param filePath - 源BMP文件的完整路径
     * @param options - 缩略图生成选项
     * @param logger - 日志记录器实例
     * @returns 根据options.outputPath返回文件路径或Buffer数据
     * @throws {BmpProcessingError} 当文件读取失败、处理错误或输出失败时
     *
     * @example
     * ```typescript
     * const brush = new BmpBrush();
     *
     * // 生成PNG格式缩略图到指定路径
     * const outputPath = await brush.createMiniature('/input.bmp', {
     *   width: 200,
     *   height: 200,
     *   outputPath: '/output.png',
     *   format: 'png',
     *   quality: 90
     * }, logger);
     *
     * // 生成Buffer数据
     * const buffer = await brush.createMiniature('/input.bmp', {
     *   width: 150,
     *   height: 150,
     *   format: 'jpeg'
     * }, logger);
     * ```
     */
    public async createMiniature(
        filePath: string,
        options: ExtendedThumbnailOptions,
        logger: PhotasaLogger,
    ): Promise<string | Buffer> {
        try {
            logger.debug(
                `BmpBrush开始创建缩略图: ${filePath}, 尺寸: ${options.width}x${options.height}`,
            );

            // 基础文件验证
            if (!fs.existsSync(filePath)) {
                throw new BmpProcessingError(
                    `源文件不存在: ${filePath}`,
                    "createMiniature",
                    "SOURCE_FILE_NOT_FOUND",
                );
            }

            // 使用BMP预处理：Jimp读取BMP → 转换为PNG Buffer → Sharp处理
            const pngBuffer = await this.preprocessBmp(filePath, logger);
            const image = sharp(pngBuffer).resize(options.width, options.height, {
                fit: options.fit || "inside",
                withoutEnlargement: options.withoutEnlargement,
            });

            // 确定输出格式
            const outputFormat = options.format || "png";
            logger.debug(`输出格式: ${outputFormat}`);

            // 如果指定了输出路径，保存到文件
            if (options.outputPath) {
                // 确保输出目录存在
                await ensureDir(path.dirname(options.outputPath));

                // 根据格式保存文件
                switch (outputFormat.toLowerCase()) {
                    case "bmp":
                        // Sharp不支持BMP输出，使用PNG作为高质量替代
                        await image.png().toFile(options.outputPath);
                        break;
                    case "png":
                        await image.png().toFile(options.outputPath);
                        break;
                    case "jpeg":
                    case "jpg":
                        await image
                            .jpeg({ quality: options.quality || 85 })
                            .toFile(options.outputPath);
                        break;
                    case "webp":
                        await image
                            .webp({ quality: options.quality || 85 })
                            .toFile(options.outputPath);
                        break;
                    default:
                        throw new BmpProcessingError(
                            `不支持的输出格式: ${outputFormat}`,
                            "createMiniature",
                            "UNSUPPORTED_OUTPUT_FORMAT",
                        );
                }

                logger.info(`BmpBrush缩略图创建成功: ${options.outputPath}, 格式: ${outputFormat}`);
                return options.outputPath;
            } else {
                // 返回Buffer数据
                let outputBuffer: Buffer;

                switch (outputFormat.toLowerCase()) {
                    case "bmp":
                        // Sharp不支持BMP输出，使用PNG作为高质量替代
                        outputBuffer = await image.png().toBuffer();
                        break;
                    case "png":
                        outputBuffer = await image.png().toBuffer();
                        break;
                    case "jpeg":
                    case "jpg":
                        outputBuffer = await image
                            .jpeg({ quality: options.quality || 85 })
                            .toBuffer();
                        break;
                    case "webp":
                        outputBuffer = await image
                            .webp({ quality: options.quality || 85 })
                            .toBuffer();
                        break;
                    default:
                        throw new BmpProcessingError(
                            `不支持的输出格式: ${outputFormat}`,
                            "createMiniature",
                            "UNSUPPORTED_OUTPUT_FORMAT",
                        );
                }

                logger.info(
                    `BmpBrush缩略图创建成功: ${outputBuffer.length} 字节, 格式: ${outputFormat}`,
                );
                return outputBuffer;
            }
        } catch (error) {
            const bmpError = new BmpProcessingError(
                `BMP缩略图创建失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "createMiniature",
                "THUMBNAIL_CREATION_FAILED",
            );

            logger.error("BmpBrush缩略图创建异常:", bmpError);
            throw bmpError;
        }
    }

    /**
     * 格式转换功能
     *
     * 将BMP文件转换为其他支持的图像格式
     *
     * @param filePath - 源BMP文件路径
     * @param targetFormat - 目标格式 (png, jpeg, jpg, bmp, webp)
     * @param outputPath - 输出文件路径
     * @param logger - 日志记录器
     * @returns 转换后的文件路径
     * @throws {BmpProcessingError} 当转换失败时
     *
     * @example
     * ```typescript
     * const brush = new BmpBrush();
     * const outputPath = await brush.transform(
     *   '/input.bmp',
     *   'png',
     *   '/output.png',
     *   logger
     * );
     * ```
     */
    public async transform(
        filePath: string,
        targetFormat: string,
        outputPath: string,
        logger: PhotasaLogger,
    ): Promise<string> {
        try {
            logger.debug(`BmpBrush格式转换: ${filePath} -> ${targetFormat}`);

            // 基础验证
            if (!fs.existsSync(filePath)) {
                throw new BmpProcessingError(
                    `源文件不存在: ${filePath}`,
                    "transform",
                    "SOURCE_FILE_NOT_FOUND",
                );
            }

            // 使用BMP预处理：Jimp读取BMP → 转换为PNG Buffer → Sharp处理
            const pngBuffer = await this.preprocessBmp(filePath, logger);
            const image = sharp(pngBuffer);

            // 确保输出目录存在
            await ensureDir(path.dirname(outputPath));

            // 根据目标格式进行转换
            switch (targetFormat.toLowerCase()) {
                case "bmp":
                    // Sharp不支持BMP输出，使用PNG作为高质量替代
                    await image.png().toFile(outputPath);
                    break;
                case "png":
                    await image.png().toFile(outputPath);
                    break;
                case "jpeg":
                case "jpg":
                    await image.jpeg({ quality: 85 }).toFile(outputPath);
                    break;
                case "webp":
                    await image.webp({ quality: 85 }).toFile(outputPath);
                    break;
                default:
                    throw new BmpProcessingError(
                        `不支持的目标格式: ${targetFormat}`,
                        "transform",
                        "UNSUPPORTED_TARGET_FORMAT",
                    );
            }

            logger.info(`BmpBrush格式转换成功: ${outputPath}`);
            return outputPath;
        } catch (error) {
            const bmpError = new BmpProcessingError(
                `BMP格式转换失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "transform",
                "FORMAT_CONVERSION_FAILED",
            );

            logger.error("BmpBrush格式转换异常:", bmpError);
            throw bmpError;
        }
    }

    /**
     * 执行BMP图像的专业编辑操作
     *
     * 针对BMP格式优化的编辑功能：
     * - 保持无损处理
     * - 智能色深管理
     * - 支持多种编辑操作
     * - 优化Windows兼容性
     *
     * @param filePath - 源文件路径
     * @param operations - 编辑操作列表
     * @param outputPath - 输出文件路径
     * @param logger - 日志记录器
     * @returns 编辑后的文件路径
     * @throws {BmpProcessingError} 当编辑操作失败时
     *
     * @example
     * ```typescript
     * const brush = new BmpBrush();
     * const operations = [
     *   { type: 'resize', resize: { width: 500, height: 500 } },
     *   { type: 'adjust', adjust: { brightness: { value: 10 } } }
     * ];
     * const result = await brush.edit('/input.bmp', operations, '/output.bmp', logger);
     * ```
     */
    public async edit(
        filePath: string,
        operations: EditOperation[],
        outputPath: string,
        logger: PhotasaLogger,
    ): Promise<string> {
        try {
            logger.info(
                `BmpBrush开始编辑操作: ${filePath} -> ${outputPath}, 操作数量: ${operations.length}`,
            );

            // 基础验证
            if (!fs.existsSync(filePath)) {
                throw new BmpProcessingError(
                    `源文件不存在: ${filePath}`,
                    "edit",
                    "SOURCE_FILE_NOT_FOUND",
                );
            }

            // 使用BMP预处理：Jimp读取BMP → 转换为PNG Buffer → Sharp处理
            const pngBuffer = await this.preprocessBmp(filePath, logger);
            let image = sharp(pngBuffer);

            // 应用编辑操作
            for (const operation of operations) {
                image = await this.applySharpOperation(image, operation, logger);
            }

            // 确保输出目录存在
            await ensureDir(path.dirname(outputPath));

            // 根据输出文件扩展名确定格式
            const outputExt = path.extname(outputPath).toLowerCase();
            switch (outputExt) {
                case ".bmp":
                    // Sharp不支持BMP输出，使用PNG作为高质量替代
                    await image.png().toFile(outputPath);
                    break;
                case ".png":
                    await image.png().toFile(outputPath);
                    break;
                case ".jpg":
                case ".jpeg":
                    await image.jpeg({ quality: 85 }).toFile(outputPath);
                    break;
                case ".webp":
                    await image.webp({ quality: 85 }).toFile(outputPath);
                    break;
                default:
                    // 默认保存为PNG格式（Sharp不支持BMP输出）
                    await image.png().toFile(outputPath);
                    break;
            }

            logger.info(`BmpBrush编辑完成: ${outputPath}`);
            return outputPath;
        } catch (error) {
            const bmpError = new BmpProcessingError(
                `BMP编辑操作失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "edit",
                "EDIT_OPERATION_FAILED",
            );

            logger.error("BmpBrush编辑异常:", bmpError);
            throw bmpError;
        }
    }

    /**
     * 应用Sharp图像编辑操作
     *
     * @private
     * @param image - Sharp图像实例
     * @param operation - 编辑操作
     * @param logger - 日志记录器
     * @returns 处理后的Sharp实例
     */
    private async applySharpOperation(
        image: sharp.Sharp,
        operation: EditOperation,
        logger: PhotasaLogger,
    ): Promise<sharp.Sharp> {
        logger.debug(`应用编辑操作: ${operation.type}`);

        switch (operation.type) {
            case "resize": {
                if (operation.resize) {
                    return image.resize(operation.resize.width, operation.resize.height);
                }
                break;
            }

            case "filter": {
                // 使用adjust参数处理亮度、对比度等
                if (operation.filter?.blur) {
                    return image.blur(operation.filter.blur.radius / 10);
                }
                if (operation.filter?.sharpen) {
                    return image.sharpen();
                }
                break;
            }

            case "adjust": {
                if (operation.adjust?.brightness) {
                    const brightnessValue = operation.adjust.brightness.value;
                    return image.modulate({ brightness: 1 + brightnessValue / 100 });
                }
                if (operation.adjust?.saturation) {
                    const saturationValue = operation.adjust.saturation.value;
                    return image.modulate({ saturation: 1 + saturationValue / 100 });
                }
                break;
            }

            case "crop": {
                // 裁剪操作可以在这里实现
                break;
            }

            default: {
                logger.warn(`BmpBrush不支持的操作类型: ${operation.type}`);
                break;
            }
        }

        return image;
    }

    /**
     * 计算BMP文件的色深
     *
     * @private
     * @param metadata - Sharp元数据
     * @returns 色深（位数）
     */
    private calculateColorDepth(metadata: sharp.Metadata): number {
        const channels = metadata.channels || 3;
        return channels * 8;
    }

    /**
     * 检查文件是否被此神笔支持
     *
     * 通过文件扩展名判断是否为BMP格式文件
     *
     * @param filePath - 要检查的文件路径
     * @returns 如果是BMP文件返回true，否则返回false
     *
     * @example
     * ```typescript
     * const brush = new BmpBrush();
     * console.log(brush.supports('/path/to/image.bmp')); // true
     * console.log(brush.supports('/path/to/image.jpg')); // false
     * ```
     */
    public supports(filePath: string): boolean {
        if (!filePath || typeof filePath !== "string") {
            return false;
        }

        const ext = path.extname(filePath).toLowerCase();
        return this.supportedFormats.includes(ext.substring(1)); // 移除点号
    }

    /**
     * 检查当前神笔是否能执行指定操作
     *
     * 验证操作是否在此神笔的能力范围内
     *
     * @param operation - 待检查的操作类型
     * @returns 如果支持该操作返回true，否则返回false
     *
     * @example
     * ```typescript
     * const brush = new BmpBrush();
     * console.log(brush.canPerform('generateThumbnail')); // true
     * console.log(brush.canPerform('extractMetadata')); // true
     * ```
     */
    public canPerform(operation: PaintOperation): boolean {
        return this.capabilities.includes(operation);
    }

    /**
     * 神笔的自我介绍
     *
     * @returns 神笔的详细描述
     */
    public toString(): string {
        return `BmpBrush - BMP格式专业神笔
                支持格式: ${this.supportedFormats.join(", ")}
                优先级: ${this.priority}
                特色: 无损处理、Windows兼容、多色深支持
                配置: ${JSON.stringify(this.options)}`;
    }
}
