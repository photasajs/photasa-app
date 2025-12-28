import fs from "fs-extra";
import path from "path";
import ExifReader from "exifreader";
import { initializeHeifModule } from "@main/wasm/heif-module";
import { extractDateTimeFromExif } from "@photasa/common";
import { extractGPSInfo } from "../parsers/gps-parser";
import { extractCameraInfo } from "../parsers/camera-parser";

import type { PhotasaLogger } from "@photasa/common";
import type { ImageMetadata } from "@photasa/common";

// 提取器返回的元数据接口（不包含dateSource，由主函数处理）
type ExtractedImageMetadata = Omit<ImageMetadata, "dateSource">;

/**
 * 初始化HEIF模块（纯函数版本，返回模块实例）
 */

/**
 * 从EXIF数据中提取图像尺寸
 */
function extractImageDimensions(
    exifData: any,
    logger: PhotasaLogger,
): { width: number; height: number } | null {
    const exifWidth = exifData.ImageWidth?.value || exifData.PixelXDimension?.value;
    const exifHeight = exifData.ImageLength?.value || exifData.PixelYDimension?.value;

    if (exifWidth && exifHeight) {
        logger.debug(`[HEIC] Got dimensions from EXIF: ${exifWidth}x${exifHeight}`);
        return { width: exifWidth, height: exifHeight };
    }

    return null;
}

/**
 * 使用WASM模块解码HEIC获取尺寸
 */
async function decodeHeicDimensions(
    buffer: Buffer,
    heifModule: any,
    logger: PhotasaLogger,
): Promise<{ width: number; height: number } | null> {
    try {
        heifModule.decode(buffer, buffer.byteLength, false);
        const { width, height } = heifModule.dimensions();
        logger.debug(`[HEIC] Got dimensions from WASM decode: ${width}x${height}`);
        return { width, height };
    } catch (error) {
        logger.error(`[HEIC] Failed to decode with WASM: ${error}`);
        return null;
    }
}

/**
 * 从HEIC文件中提取EXIF数据
 */
async function extractHeicExif(
    buffer: Buffer,
    filePath: string,
    logger: PhotasaLogger,
): Promise<{
    exifData: any;
    extractedDateTime: Date | null;
}> {
    try {
        const tags = ExifReader.load(buffer);
        delete tags["MakerNote"]; // 移除大型标签以节省内存

        logger.debug(
            `[HEIC] Processing ${path.basename(filePath)} - Extracted ${Object.keys(tags).length} EXIF tags`,
        );

        // 记录可用的EXIF标签用于调试
        const availableTags = Object.keys(tags).slice(0, 10).join(", ");
        logger.debug(
            `[HEIC] Available EXIF tags: ${availableTags}${Object.keys(tags).length > 10 ? "..." : ""}`,
        );

        const extractedDateTime = extractDateTimeFromExif(tags);

        logger.debug(
            `[HEIC] ${path.basename(filePath)} - EXIF dateTime: ${extractedDateTime ? extractedDateTime.toISOString() : "null"}`,
        );

        return {
            exifData: tags,
            extractedDateTime,
        };
    } catch (error) {
        logger.error(`[HEIC] Failed to extract EXIF from ${path.basename(filePath)}: ${error}`);
        logger.error(
            `[HEIC] Error details: ${error instanceof Error ? error.stack : String(error)}`,
        );
        return {
            exifData: null,
            extractedDateTime: null,
        };
    }
}

/**
 * 提取HEIC文件的元数据（纯函数版本）
 * @param filePath 文件路径
 * @param logger 日志记录器
 * @returns Promise<ImageMetadata>
 */
export async function extractHeicMetadata(
    filePath: string,
    logger: PhotasaLogger,
): Promise<ExtractedImageMetadata | null> {
    try {
        const buffer = await fs.readFile(filePath);

        // 初始化HEIF模块
        let heifModule: any = null;
        try {
            heifModule = await initializeHeifModule();
            logger.debug(`[HEIC] HEIF module initialized successfully`);
        } catch (error) {
            logger.warn(`[HEIC] Failed to initialize HEIF module: ${error}`);
            // Continue without HEIF module - we can still extract EXIF data
        }

        // 提取EXIF数据
        const { exifData, extractedDateTime } = await extractHeicExif(buffer, filePath, logger);

        // 尝试从EXIF中提取图像尺寸
        let imageInfo = extractImageDimensions(exifData, logger);

        if (!imageInfo && heifModule) {
            // 如果EXIF中没有尺寸信息且WASM可用，则解码HEIC获取
            imageInfo = await decodeHeicDimensions(buffer, heifModule, logger);
        }

        // 如果成功提取到EXIF日期，使用它；否则返回null让主函数处理回退
        if (extractedDateTime) {
            logger.debug(
                `[HEIC] ${path.basename(filePath)} - Successfully extracted EXIF date: ${extractedDateTime.toISOString()}`,
            );
            return {
                width: imageInfo?.width || 0,
                height: imageInfo?.height || 0,
                dateTime: extractedDateTime,
                gpsInfo: extractGPSInfo(exifData) || undefined,
                cameraInfo: extractCameraInfo(exifData) || undefined,
                format: "HEIC",
            };
        } else {
            logger.debug(
                `[HEIC] ${path.basename(filePath)} - No EXIF date extracted, returning null for fallback handling`,
            );
            return null;
        }
    } catch (error) {
        logger.error(`[HEIC] Error processing ${filePath}: ${error}`);
        // Return null on failure - let extractMetadata handle fallback
        return null;
    }
}

/**
 * 检查文件是否为HEIC格式
 */
export function isHeicFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return [".heic", ".heif"].includes(ext);
}
