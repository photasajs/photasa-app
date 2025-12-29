/**
 * HeicBrush - HEIC/HEIF格式神笔
 * 专门处理HEIC/HEIF格式图像，基于wasm-heif库
 */

import fs from "fs-extra";
import path from "path";
import sharp from "sharp";
import ExifReader from "exifreader";
import { initializeHeifModule } from "@photasa/maliang-bundle";
import { extractDateTimeFromExif } from "@photasa/common";
import { extractGPSInfo } from "../../parsers/gps-parser";
import { extractCameraInfo } from "../../parsers/camera-parser";
import { BaseMagicBrush } from "../../core/MagicBrush";

import type { PhotasaLogger } from "@photasa/common";
import type { Metadata, ThumbnailOptions, PaintOperation } from "../../types/BrushTypes";

/**
 * HEIC处理错误类
 */
export class HeicProcessingError extends Error {
    public readonly code: string;
    constructor(message: string, code = "HEIC_ERROR") {
        super(message);
        this.name = "HeicProcessingError";
        this.code = code;
    }
}

/**
 * HeicBrush - HEIC/HEIF格式专用神笔
 * 技术原因：需要专门的WASM-HEIF解码模块
 */
export class HeicBrush extends BaseMagicBrush {
    public readonly name = "HeicBrush";
    public readonly supportedFormats = ["heic", "heif"];
    public readonly capabilities: PaintOperation[] = [
        "extractMetadata",
        "generateThumbnail",
        "convertFormat",
    ];

    private heifModule: any = null;
    private initialized = false;

    /**
     * 初始化HEIF模块
     */
    public async initialize(_?: Record<string, any>, logger?: PhotasaLogger): Promise<void> {
        if (this.initialized && this.heifModule) {
            logger?.debug(`${this.name} already initialized`);
            return;
        }

        try {
            this.heifModule = await initializeHeifModule();
            this.initialized = true;
            logger?.info(`${this.name} initialized successfully`);
        } catch (error) {
            logger?.error(`${this.name} failed to initialize:`, error);
            throw new HeicProcessingError(
                `Failed to initialize HEIF module: ${error}`,
                "INIT_FAILED",
            );
        }
    }

    /**
     * 提取HEIC文件元数据
     */
    public async extractEssence(filePath: string, logger: PhotasaLogger): Promise<Metadata | null> {
        logger.debug(`[${this.name}] Extracting metadata from ${filePath}`);
        this.validateFilePath(filePath);

        try {
            const buffer = await fs.readFile(filePath);

            // 提取EXIF数据
            const exifData = await this.extractExifData(buffer, filePath, logger);

            // 提取图像尺寸
            const dimensions = await this.extractDimensions(buffer, exifData, logger);

            // 提取日期时间
            const dateTime = extractDateTimeFromExif(exifData);

            // 提取GPS信息
            const gpsInfo = extractGPSInfo(exifData);

            // 提取相机信息
            const cameraInfo = extractCameraInfo(exifData);

            const metadata: Metadata = {
                width: dimensions?.width || 0,
                height: dimensions?.height || 0,
                format: "HEIC",
                colorSpace: exifData?.ColorSpace?.description || undefined,
                bitDepth: exifData?.BitsPerSample?.value || undefined,
                dateTime: dateTime || undefined,
                gpsInfo: gpsInfo || undefined,
                cameraInfo: cameraInfo || undefined,
                orientation: exifData?.Orientation?.value || undefined,
            };

            logger.debug(`[${this.name}] Successfully extracted metadata:`, metadata);
            return metadata;
        } catch (error) {
            logger.error(`[${this.name}] Failed to extract metadata:`, error);
            return null;
        }
    }

    /**
     * 创建HEIC文件缩略图（可选择同时生成预览图）
     */
    public async createMiniature(
        filePath: string,
        options: ThumbnailOptions,
        logger: PhotasaLogger,
    ): Promise<string | Buffer> {
        logger.debug(`[${this.name}] Creating thumbnail for ${filePath}`);
        this.validateFilePath(filePath);
        this.validateOptions(options, ["width", "height"]);

        try {
            // 确保HEIF模块已初始化
            if (!this.initialized || !this.heifModule) {
                await this.initialize({}, logger);
            }

            const buffer = await fs.readFile(filePath);

            // 使用WASM模块解码HEIC（一次解码，多重输出）
            const decoded = await this.decodeHeic(buffer, logger);
            logger.debug(`Decoded HEIC data keys: ${Object.keys(decoded || {})}`);
            logger.debug(
                `Decoded dimensions: ${decoded?.width}x${decoded?.height}, channels: ${decoded?.channels}`,
            );

            const {
                width: originalWidth,
                height: originalHeight,
                data: rgbaBuffer,
                channels,
            } = decoded;

            // 并行生成缩略图和预览图
            const tasks: Promise<any>[] = [];

            // 任务1：生成缩略图
            const thumbnailTask = this.generateThumbnailFromRgba(
                rgbaBuffer,
                originalWidth,
                originalHeight,
                options,
                logger,
                channels,
            );
            tasks.push(thumbnailTask);

            // 任务2：如果需要，生成预览图
            if (options.generatePreview && options.previewPath) {
                const previewTask = this.generatePreviewFromRgba(
                    rgbaBuffer,
                    originalWidth,
                    originalHeight,
                    options,
                    logger,
                    channels,
                );
                tasks.push(previewTask);
                logger.debug(`[${this.name}] Generating both thumbnail and preview simultaneously`);
            }

            // 等待所有任务完成
            const results = await Promise.all(tasks);

            // 返回缩略图结果（第一个任务的结果）
            const thumbnailResult = results[0];

            if (options.generatePreview && results.length > 1) {
                logger.info(
                    `[${this.name}] Successfully created both thumbnail and preview for ${filePath}`,
                );
            } else {
                logger.info(`[${this.name}] Successfully created thumbnail for ${filePath}`);
            }

            return thumbnailResult;
        } catch (error) {
            logger.error(`[${this.name}] Failed to create thumbnail:`, error);
            throw new HeicProcessingError(
                `Failed to create HEIC thumbnail: ${error}`,
                "THUMBNAIL_FAILED",
            );
        }
    }

    /**
     * 从RGBA缓冲区生成缩略图
     */
    private async generateThumbnailFromRgba(
        rgbaBuffer: Buffer,
        originalWidth: number,
        originalHeight: number,
        options: ThumbnailOptions,
        logger: PhotasaLogger,
        channels = 4,
    ): Promise<string | Buffer> {
        // 使用Sharp处理解码后的数据
        let pipeline = sharp(rgbaBuffer, {
            raw: {
                width: originalWidth,
                height: originalHeight,
                channels: channels as 3 | 4,
            },
        });

        // 应用旋转（根据EXIF信息）
        pipeline = pipeline.rotate();

        // 调整大小
        pipeline = pipeline.resize(options.width, options.height, {
            fit: options.fit || "inside",
            background: options.background || { r: 255, g: 255, b: 255, alpha: 1 },
            withoutEnlargement: options.withoutEnlargement !== false,
        });

        // 设置输出格式
        const outputFormat = options.format || "png";
        pipeline = pipeline.toFormat(outputFormat as any, {
            quality: options.quality || 90,
        });

        // 输出到文件或Buffer
        if (options.outputPath) {
            await pipeline.toFile(options.outputPath);
            logger.debug(`[${this.name}] Created thumbnail at ${options.outputPath}`);
            return options.outputPath;
        } else {
            const buffer = await pipeline.toBuffer();
            logger.debug(`[${this.name}] Created thumbnail buffer`);
            return buffer;
        }
    }

    /**
     * 从RGBA缓冲区生成预览图
     */
    private async generatePreviewFromRgba(
        rgbaBuffer: Buffer,
        originalWidth: number,
        originalHeight: number,
        options: ThumbnailOptions,
        logger: PhotasaLogger,
        channels = 4,
    ): Promise<string> {
        if (!options.previewPath) {
            throw new HeicProcessingError(
                "Preview path is required for preview generation",
                "PREVIEW_PATH_MISSING",
            );
        }

        // 使用Sharp处理解码后的数据
        let pipeline = sharp(rgbaBuffer, {
            raw: {
                width: originalWidth,
                height: originalHeight,
                channels: channels as 3 | 4,
            },
        });

        // 应用旋转（根据EXIF信息）
        pipeline = pipeline.rotate();

        // 预览图通常不需要调整大小，保持原始尺寸或设置最大尺寸限制
        // 但为了浏览器性能，可以设置合理的最大尺寸
        const maxPreviewSize = 2048; // 最大2K分辨率
        if (originalWidth > maxPreviewSize || originalHeight > maxPreviewSize) {
            pipeline = pipeline.resize(maxPreviewSize, maxPreviewSize, {
                fit: "inside",
                withoutEnlargement: true,
            });
        }

        // 设置预览图格式和质量
        const previewFormat = options.previewFormat || "jpeg";
        const previewQuality = options.previewQuality || 95;
        pipeline = pipeline.toFormat(previewFormat as any, {
            quality: previewQuality,
        });

        // 输出预览图到文件
        await pipeline.toFile(options.previewPath);

        // 验证输出文件
        if (!(await fs.pathExists(options.previewPath))) {
            throw new HeicProcessingError(
                "Preview generation completed but output file does not exist",
                "PREVIEW_OUTPUT_MISSING",
            );
        }

        logger.debug(`[${this.name}] Created preview at ${options.previewPath}`);
        return options.previewPath;
    }

    /**
     * 转换HEIC格式到其他格式
     */
    public async transform(
        filePath: string,
        targetFormat: string,
        outputPath: string,
        logger: PhotasaLogger,
    ): Promise<string> {
        logger.debug(`[${this.name}] Converting ${filePath} to ${targetFormat}`);
        this.validateFilePath(filePath);

        try {
            // 确保HEIF模块已初始化
            if (!this.initialized || !this.heifModule) {
                await this.initialize({}, logger);
            }

            const buffer = await fs.readFile(filePath);

            // 使用WASM模块解码HEIC
            const {
                width,
                height,
                data: rgbaBuffer,
                channels,
            } = await this.decodeHeic(buffer, logger);

            // 使用Sharp处理解码后的数据并转换格式
            await sharp(rgbaBuffer, {
                raw: {
                    width,
                    height,
                    channels: channels as 3 | 4,
                },
            })
                .rotate() // 应用EXIF旋转
                .toFormat(targetFormat as any, {
                    quality: 90,
                })
                .toFile(outputPath);

            // 验证输出文件
            if (!(await fs.pathExists(outputPath))) {
                throw new HeicProcessingError(
                    "Conversion completed but output file does not exist",
                    "OUTPUT_MISSING",
                );
            }

            logger.info(`[${this.name}] Successfully converted to ${outputPath}`);
            return outputPath;
        } catch (error) {
            logger.error(`[${this.name}] Failed to convert:`, error);
            throw new HeicProcessingError(
                `Failed to convert HEIC to ${targetFormat}: ${error}`,
                "TRANSFORM_FAILED",
            );
        }
    }

    /**
     * 清理资源
     */
    public async cleanup(logger?: PhotasaLogger): Promise<void> {
        if (this.heifModule) {
            this.heifModule = null;
            this.initialized = false;
            logger?.debug(`${this.name} cleaned up`);
        }
    }

    // === 私有辅助方法 ===

    /**
     * 提取EXIF数据
     */
    private async extractExifData(
        buffer: Buffer,
        filePath: string,
        logger: PhotasaLogger,
    ): Promise<any> {
        try {
            const tags = ExifReader.load(buffer);
            delete tags["MakerNote"]; // 移除大型标签以节省内存

            logger.debug(
                `[${this.name}] Extracted ${Object.keys(tags).length} EXIF tags from ${path.basename(filePath)}`,
            );

            return tags;
        } catch (error) {
            logger.warn(`[${this.name}] Failed to extract EXIF data:`, error);
            return {};
        }
    }

    /**
     * 提取图像尺寸
     */
    private async extractDimensions(
        buffer: Buffer,
        exifData: any,
        logger: PhotasaLogger,
    ): Promise<{ width: number; height: number } | null> {
        // 首先尝试从EXIF获取尺寸
        const exifWidth = exifData?.ImageWidth?.value || exifData?.PixelXDimension?.value;
        const exifHeight = exifData?.ImageLength?.value || exifData?.PixelYDimension?.value;

        if (exifWidth && exifHeight) {
            logger.debug(`[${this.name}] Got dimensions from EXIF: ${exifWidth}x${exifHeight}`);
            return { width: exifWidth, height: exifHeight };
        }

        // 如果EXIF中没有，尝试使用WASM模块解码获取
        try {
            if (!this.initialized || !this.heifModule) {
                await this.initialize({}, logger);
            }

            // WASM-HEIF v2.0+ uses decode to get dimensions if not using dimensions()
            // Try standard decode first as it is more reliable for actual dimensions
            const result = this.heifModule.decode(buffer, buffer.length, false);
            const image = Array.isArray(result) ? result[0] : result;

            if (image && image.width && image.height) {
                logger.debug(
                    `[${this.name}] Got dimensions from WASM decode: ${image.width}x${image.height}`,
                );
                return { width: image.width, height: image.height };
            }

            // Fallback to dimensions()
            if (this.heifModule.dimensions) {
                const dims = this.heifModule.dimensions();
                if (dims && dims.width && dims.height) {
                    logger.debug(
                        `[${this.name}] Got dimensions from WASM dimensions(): ${dims.width}x${dims.height}`,
                    );
                    return { width: dims.width, height: dims.height };
                }
            }

            return null;
        } catch (error) {
            logger.error(`[${this.name}] Failed to get dimensions:`, error);
            // Try dimensions() as last resort even if decode failed
            try {
                if (this.heifModule && this.heifModule.dimensions) {
                    const dims = this.heifModule.dimensions();
                    if (dims && dims.width && dims.height) {
                        return { width: dims.width, height: dims.height };
                    }
                }
            } catch (e) {
                /* ignore */
            }
            return null;
        }
    }

    /**
     * 使用WASM模块解码HEIC文件
     */
    private async decodeHeic(
        buffer: Buffer,
        logger: PhotasaLogger,
    ): Promise<{ width: number; height: number; data: Buffer; channels: number }> {
        try {
            if (!this.heifModule) {
                throw new Error("Module not initialized");
            }

            // 解码HEIC文件 (v2.0 API: decode(buffer, length, all))
            const result = this.heifModule.decode(buffer, buffer.length, false);

            if (!result) {
                throw new Error("Failed to decode HEIC: no result returned");
            }

            // Handle possible array return (though v2.0 usually returns Uint8Array or object with data)
            const pixelDataRaw = Array.isArray(result) ? result[0] : result;

            // Ensure we have a buffer
            let data: Buffer;
            if (Buffer.isBuffer(pixelDataRaw)) {
                data = pixelDataRaw;
            } else if (
                pixelDataRaw instanceof Uint8Array ||
                pixelDataRaw instanceof Uint8ClampedArray
            ) {
                data = Buffer.from(pixelDataRaw);
            } else if (pixelDataRaw && typeof pixelDataRaw === "object" && "data" in pixelDataRaw) {
                // Maybe v1.0 style object?
                data = Buffer.from(pixelDataRaw.data);
            } else {
                // Fallback for weird array-like objects
                data = Buffer.from(pixelDataRaw);
            }

            if (!data || data.length === 0) {
                throw new Error("HEIF decode produced empty data");
            }

            // Get dimensions
            // In v2.0, we must call dimensions() after decode() or check if result has them
            let width = 0;
            let height = 0;

            // Check if result object has dimensions (v1 style or if wrapper added them)
            if (pixelDataRaw && typeof pixelDataRaw === "object") {
                if ("width" in pixelDataRaw) width = pixelDataRaw.width;
                if ("height" in pixelDataRaw) height = pixelDataRaw.height;
            }

            // If not, call dimensions()
            if (
                (!width || !height) &&
                this.heifModule.dimensions &&
                typeof this.heifModule.dimensions === "function"
            ) {
                const dims = this.heifModule.dimensions();
                if (dims) {
                    width = dims.width;
                    height = dims.height;
                }
            }

            if (!width || !height) {
                throw new Error("Failed to determine HEIF dimensions after decode");
            }

            // Calculate channels based on data length and dimensions
            const pixels = width * height;
            const channels = Math.floor(data.length / pixels);

            if (channels !== 3 && channels !== 4) {
                logger.warn(
                    `[${this.name}] Unexpected channel count: ${channels} (size: ${data.length}, pixels: ${pixels})`,
                );
            }

            logger.debug(
                `[${this.name}] Successfully decoded HEIC: ${width}x${height}, channels: ${channels}, size: ${data.length}`,
            );

            return {
                width: width,
                height: height,
                data: data,
                channels: channels,
            };
        } catch (error) {
            throw new HeicProcessingError(
                `Failed to decode HEIC with WASM: ${error}`,
                "DECODE_FAILED",
            );
        }
    }
}
