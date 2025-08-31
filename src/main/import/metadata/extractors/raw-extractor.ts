import fs from "fs-extra";
import path from "path";
import ExifReader from "exifreader";
import { extractDateTimeFromExif } from "@common/exif-util";
import { extractGPSInfo } from "../parsers/gps-parser";
import { extractCameraInfo } from "../parsers/camera-parser";
import { getDateFallback } from "../parsers/date-parser";
import type { PhotasaLogger } from "@common/logger";
import type { ImageMetadata } from "@common/import-types";

/**
 * RAW文件扩展名列表
 */
export const RAW_EXTENSIONS = [
    ".cr2",
    ".cr3", // Canon
    ".nef", // Nikon
    ".arw", // Sony
    ".dng", // Adobe
    ".raf", // Fujifilm
    ".orf", // Olympus
    ".rw2", // Panasonic
    ".pef", // Pentax
    ".x3f", // Sigma
    ".3fr", // Hasselblad
    ".fff", // Imacon
    ".mef", // Mamiya
    ".mrw", // Minolta
    ".srw", // Samsung
];

/**
 * 从EXIF数据中提取图像尺寸
 */
function extractRawImageDimensions(tags: any): { width: number; height: number } {
    return {
        width: (tags.ImageWidth?.value as number) || 0,
        height: (tags.ImageLength?.value as number) || 0,
    };
}

/**
 * 提取RAW文件的元数据（纯函数版本）
 * @param filePath 文件路径
 * @param logger 日志记录器
 * @returns Promise<ImageMetadata>
 */
export async function extractRawMetadata(
    filePath: string,
    logger: PhotasaLogger,
): Promise<ImageMetadata> {
    try {
        const buffer = await fs.readFile(filePath);
        const tags = ExifReader.load(buffer);
        delete tags["MakerNote"]; // 移除大型标签

        const dateTime = extractDateTimeFromExif(tags);
        const gpsInfo = extractGPSInfo(tags);
        const cameraInfo = extractCameraInfo(tags);
        const dimensions = extractRawImageDimensions(tags);

        return {
            ...dimensions,
            dateTime: dateTime || undefined,
            gpsInfo: gpsInfo || undefined,
            cameraInfo: cameraInfo || undefined,
            format: path.extname(filePath).slice(1).toUpperCase(),
            dateSource: dateTime ? "exif" : "file_created",
        };
    } catch (error) {
        logger.error(`[RAW] Error processing ${filePath}: ${error}`);

        // 回退到基本文件信息
        const stats = await fs.stat(filePath);
        const fallback = getDateFallback(stats.birthtime, logger);

        return {
            dateTime: fallback.date,
            dateSource: fallback.source === "file_created" ? "file_created" : "file_created",
            format: path.extname(filePath).slice(1).toUpperCase(),
            width: 0,
            height: 0,
        };
    }
}

/**
 * 检查文件是否为RAW格式
 */
export function isRawFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return RAW_EXTENSIONS.includes(ext);
}

/**
 * 获取RAW格式的相机品牌
 */
export function getRawCameraBrand(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const brandMap: Record<string, string> = {
        ".cr2": "Canon",
        ".cr3": "Canon",
        ".nef": "Nikon",
        ".arw": "Sony",
        ".dng": "Adobe",
        ".raf": "Fujifilm",
        ".orf": "Olympus",
        ".rw2": "Panasonic",
        ".pef": "Pentax",
        ".x3f": "Sigma",
        ".3fr": "Hasselblad",
        ".fff": "Imacon",
        ".mef": "Mamiya",
        ".mrw": "Minolta",
        ".srw": "Samsung",
    };

    return brandMap[ext] || "Unknown";
}
