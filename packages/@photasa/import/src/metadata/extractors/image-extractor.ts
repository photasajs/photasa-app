import fs from "fs-extra";
import path from "path";
import ExifReader from "exifreader";
import { extractDateTimeFromExif } from "@photasa/common";
import { extractGPSInfo, extractCameraInfo } from "@photasa/maliang";
import type { PhotasaLogger } from "@photasa/common";
import type { ImageMetadata } from "@photasa/common";

// 提取器返回的元数据接口（不包含dateSource，由主函数处理）
type ExtractedImageMetadata = Omit<ImageMetadata, "dateSource">;

/**
 * 支持的常规图片扩展名列表
 */
export const IMAGE_EXTENSIONS = [
    ".jpg",
    ".jpeg", // JPEG
    ".png", // PNG
    ".tiff",
    ".tif", // TIFF
    ".bmp", // Bitmap
    ".gif", // GIF
    ".webp", // WebP
];

/**
 * 从EXIF数据中提取图像尺寸
 */
function extractImageDimensions(tags: any): { width: number; height: number } {
    const width = tags.ImageWidth?.value || tags.PixelXDimension?.value || 0;
    const height = tags.ImageLength?.value || tags.PixelYDimension?.value || 0;

    return { width, height };
}

/**
 * 提取常规图片文件的元数据（纯函数版本）
 * @param filePath 文件路径
 * @param logger 日志记录器
 * @returns Promise<ImageMetadata>
 */
export async function extractImageMetadata(
    filePath: string,
    logger: PhotasaLogger,
): Promise<ExtractedImageMetadata | null> {
    try {
        const buffer = await fs.readFile(filePath);
        const tags = ExifReader.load(buffer);
        delete tags["MakerNote"]; // 移除大型标签以节省内存

        logger.debug(
            `[Image] Processing ${path.basename(filePath)} - Extracted ${Object.keys(tags).length} EXIF tags`,
        );

        const dateTime = extractDateTimeFromExif(tags);
        const gpsInfo = extractGPSInfo(tags);
        const cameraInfo = extractCameraInfo(tags);
        const dimensions = extractImageDimensions(tags);

        if (!dateTime) {
            logger.debug(
                `[Image] ${path.basename(filePath)} - No EXIF date extracted, returning null for fallback handling`,
            );
            return null;
        }

        logger.debug(
            `[Image] ${path.basename(filePath)} - EXIF dateTime: ${dateTime ? dateTime.toISOString() : "null"}`,
        );

        const result = {
            ...dimensions,
            dateTime: dateTime || undefined,
            gpsInfo: gpsInfo || undefined,
            cameraInfo: cameraInfo || undefined,
            format: path.extname(filePath).slice(1).toUpperCase(),
        };

        logger.debug(
            `[Image] ${path.basename(filePath)} - Final result: dateTime=${result.dateTime ? result.dateTime.toISOString() : "undefined"}`,
        );

        return result;
    } catch (error) {
        logger.error(`[Image] Error processing ${filePath}: ${error}`);
        // Return null on failure - let extractMetadata handle fallback
        return null;
    }
}

/**
 * 检查文件是否为常规图片格式
 */
export function isImageFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * 检查是否为JPEG文件
 */
export function isJpegFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return [".jpg", ".jpeg"].includes(ext);
}

/**
 * 获取图片格式的显示名称
 */
export function getImageFormatName(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const formatNames: Record<string, string> = {
        jpg: "JPEG",
        jpeg: "JPEG",
        png: "PNG",
        tiff: "TIFF",
        tif: "TIFF",
        bmp: "Bitmap",
        gif: "GIF",
        webp: "WebP",
    };

    return formatNames[ext] || ext.toUpperCase();
}
