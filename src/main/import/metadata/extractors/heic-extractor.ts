import fs from "fs-extra";
import path from "path";
import ExifReader from "exifreader";
import createHeifModule from "@saschazar/wasm-heif";
import { extractDateTimeFromExif } from "@common/exif-util";
import { extractGPSInfo } from "../parsers/gps-parser";
import { extractCameraInfo } from "../parsers/camera-parser";
import { getDateFallback } from "../parsers/date-parser";
import type { PhotasaLogger } from "@common/logger";
import type { ImageMetadata, DateSource } from "@common/import-types";

/**
 * HEIF/HEIC模块状态
 */
interface HeifModuleState {
    module: any;
    initialized: boolean;
}

let heifState: HeifModuleState = {
    module: null,
    initialized: false,
};

/**
 * 初始化HEIF模块（纯函数版本，返回模块实例）
 */
async function initializeHeifModule(): Promise<any> {
    if (heifState.initialized && heifState.module) {
        return heifState.module;
    }

    try {
        // 使用默认配置初始化HEIF模块
        const module = await createHeifModule();
        heifState = { module, initialized: true };
        return module;
    } catch (error) {
        // 如果默认初始化失败，尝试使用WASM文件
        const wasmPath = path.join(__dirname, "../../../../../resources/wasm_heif.wasm");
        if (await fs.pathExists(wasmPath)) {
            const wasmBinary = await fs.readFile(wasmPath);
            const module = await createHeifModule({
                wasmBinary: wasmBinary as any,
            } as any);
            heifState = { module, initialized: true };
            return module;
        } else {
            throw new Error("HEIF WASM module not found and default initialization failed");
        }
    }
}

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
    logger: PhotasaLogger,
): Promise<{
    exifData: any;
    extractedDateTime: Date | null;
}> {
    try {
        const tags = ExifReader.load(buffer);
        delete tags["MakerNote"]; // 移除大型标签以节省内存

        const extractedDateTime = extractDateTimeFromExif(tags);

        return {
            exifData: tags,
            extractedDateTime,
        };
    } catch (error) {
        logger.warn(`[HEIC] Failed to extract EXIF: ${error}`);
        return {
            exifData: null,
            extractedDateTime: null,
        };
    }
}

/**
 * 确定最终使用的日期和日期源
 */
function determineFinalDate(
    extractedDateTime: Date | null,
    fileCreatedTime: Date,
    logger: PhotasaLogger,
): { finalDateTime: Date; dateSource: DateSource } {
    if (extractedDateTime) {
        logger.debug(`[HEIC] Using EXIF date: ${extractedDateTime}`);
        return {
            finalDateTime: extractedDateTime,
            dateSource: "exif",
        };
    }

    const fallback = getDateFallback(fileCreatedTime, logger);
    return {
        finalDateTime: fallback.date,
        dateSource: fallback.source === "file_created" ? "file_created" : "file_created",
    };
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
): Promise<ImageMetadata> {
    try {
        const buffer = await fs.readFile(filePath);
        const stats = await fs.stat(filePath);
        const fileCreatedTime = stats.birthtime;

        // 初始化HEIF模块
        const heifModule = await initializeHeifModule();

        // 提取EXIF数据
        const { exifData, extractedDateTime } = await extractHeicExif(buffer, logger);

        // 尝试从EXIF中提取图像尺寸
        let imageInfo = extractImageDimensions(exifData, logger);

        if (!imageInfo && heifModule) {
            // 如果EXIF中没有尺寸信息且WASM可用，则解码HEIC获取
            imageInfo = await decodeHeicDimensions(buffer, heifModule, logger);
        }

        // 确定最终使用的日期和日期源
        const { finalDateTime, dateSource } = determineFinalDate(
            extractedDateTime,
            fileCreatedTime,
            logger,
        );

        return {
            width: imageInfo?.width || 0,
            height: imageInfo?.height || 0,
            dateTime: finalDateTime,
            gpsInfo: extractGPSInfo(exifData) || undefined,
            cameraInfo: extractCameraInfo(exifData) || undefined,
            format: "HEIC",
            dateSource,
        };
    } catch (error) {
        logger.error(`[HEIC] Error processing ${filePath}: ${error}`);

        // 回退到文件统计信息
        const stats = await fs.stat(filePath);
        const fallback = getDateFallback(stats.birthtime, logger);

        return {
            width: 0,
            height: 0,
            dateTime: fallback.date,
            gpsInfo: undefined,
            cameraInfo: undefined,
            format: "HEIC",
            dateSource: fallback.source === "file_created" ? "file_created" : "file_created",
        };
    }
}

/**
 * 检查文件是否为HEIC格式
 */
export function isHeicFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return [".heic", ".heif"].includes(ext);
}

/**
 * 清理HEIF模块状态（用于测试或重置）
 */
export function resetHeifModule(): void {
    heifState = {
        module: null,
        initialized: false,
    };
}
