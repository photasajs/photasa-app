import fs from "fs-extra";
import path from "path";
import { extractHeicMetadata, isHeicFile } from "./extractors/heic-extractor";
import { extractVideoMetadata, isSupportedVideoFile } from "./extractors/video-extractor";
import { extractRawMetadata, isRawFile } from "./extractors/raw-extractor";
import { extractImageMetadata, isImageFile } from "./extractors/image-extractor";
import { extractPsdMetadata, isPsdFile } from "./extractors/psd-extractor";
import { generateDatePath, isValidDate, computeFallbackDate } from "./parsers/date-parser";
import type { PhotasaLogger } from "@common/logger";
import type { MetadataRequest, FileMetadata, FileGroup } from "@common/import-types";

type MediaType = "heic" | "image" | "raw" | "video" | "psd" | "other";
/**
 * 计算标准化的文件格式
 * @param filePath 文件路径
 * @returns 标准化的格式字符串
 */
function computeNormalizedFormat(filePath: string): string {
    const ext = path.extname(filePath).slice(1).toLowerCase();

    // 特殊处理某些文件类型
    switch (ext) {
        case "heic":
            return "HEIC";
        case "mov":
            return "MOV";
        case "mp4":
            return "MP4";
        case "avi":
            return "AVI";
        case "jpg":
        case "jpeg":
            return "JPEG";
        case "png":
            return "PNG";
        case "gif":
            return "GIF";
        case "bmp":
            return "BMP";
        case "tiff":
        case "tif":
            return "TIFF";
        case "raw":
        case "cr2":
        case "nef":
        case "arw":
            return "RAW";
        case "psd":
            return "PSD";
        case "sketch":
            return "SKETCH";
        case "figma":
            return "FIGMA";
        case "xd":
            return "XD";
        default:
            return ext.toUpperCase();
    }
}

/**
 * 创建回退元数据（消除重复逻辑）
 */
function createFallbackMetadata(
    baseMetadata: any,
    filePath: string,
    stats: any,
    fileType: MediaType,
    logger: PhotasaLogger,
): FileMetadata {
    const fallback = computeFallbackDate(stats.birthtime, stats.mtime, logger);
    logger.warn(
        `[extractMetadata] ${fileType} metadata extraction failed for ${filePath}, using smart fallback`,
    );

    const commonFallback = {
        ...baseMetadata,
        type: fileType,
        dateTime: fallback.date,
        dateSource: fallback.source,
        format: computeNormalizedFormat(filePath),
    };

    if (fileType === "image") {
        return {
            ...commonFallback,
            width: 0,
            height: 0,
        };
    } else {
        // video
        return {
            ...commonFallback,
            duration: 0,
            width: 0,
            height: 0,
        };
    }
}

const MediaType = {
    HEIC: "heic",
    RAW: "raw",
    IMAGE: "image",
    VIDEO: "video",
    PSD: "psd",
    OTHER: "other",
} as const;

const MediaExtractorTypeMap = {
    [MediaType.HEIC]: extractHeicMetadata,
    [MediaType.IMAGE]: extractImageMetadata,
    [MediaType.VIDEO]: extractVideoMetadata,
    [MediaType.RAW]: extractRawMetadata,
    [MediaType.PSD]: extractPsdMetadata,
} as const;

const MediaBuilderTypeMap = {
    [MediaType.HEIC]: (baseMetadata: any, heicMetadata: any) => ({
        ...baseMetadata,
        ...heicMetadata,
        type: "image" as const,
        // 确保null转换为undefined以符合FileMetadata接口
        dateTime: heicMetadata.dateTime || undefined,
        gpsInfo: heicMetadata.gpsInfo || undefined,
        cameraInfo: heicMetadata.cameraInfo || undefined,
        // 设置dateSource：如果有有效日期则为exif，否则使用fallback
        dateSource: heicMetadata.dateTime ? "exif" : "file_created",
    }),
    [MediaType.IMAGE]: (baseMetadata: any, imageMetadata: any) => ({
        ...baseMetadata,
        ...imageMetadata,
        type: "image" as const,
        dateTime: imageMetadata.dateTime || undefined,
        gpsInfo: imageMetadata.gpsInfo || undefined,
        cameraInfo: imageMetadata.cameraInfo || undefined,
        // 设置dateSource：如果有有效日期则为exif，否则使用fallback
        dateSource: imageMetadata.dateTime ? "exif" : "file_created",
    }),
    [MediaType.VIDEO]: (baseMetadata: any, videoMetadata: any) => ({
        ...baseMetadata,
        ...videoMetadata,
        type: "video" as const,
        // 确保null转换为undefined以符合FileMetadata接口
        dateTime: videoMetadata.creationTime || undefined,
        gpsInfo: videoMetadata.gpsInfo || undefined,
        // 设置dateSource：如果有有效日期则为video_metadata，否则使用fallback
        dateSource: videoMetadata.creationTime ? "video_metadata" : "file_created",
    }),
    [MediaType.RAW]: (baseMetadata: any, rawMetadata: any) => ({
        ...baseMetadata,
        ...rawMetadata,
        type: "image" as const,
        // 确保null转换为undefined以符合FileMetadata接口
        dateTime: rawMetadata.dateTime || undefined,
        gpsInfo: rawMetadata.gpsInfo || undefined,
        cameraInfo: rawMetadata.cameraInfo || undefined,
        // 设置dateSource：如果有有效日期则为exif，否则使用fallback
        dateSource: rawMetadata.dateTime ? "exif" : "file_created",
    }),
    [MediaType.PSD]: (baseMetadata: any, psdMetadata: any) => ({
        ...baseMetadata,
        ...psdMetadata,
        type: "ai" as const,
        // PSD文件使用文件创建时间作为日期
        dateTime: psdMetadata.createdTime || undefined,
        // 设置dateSource为file_created，因为PSD文件通常没有EXIF数据
        dateSource: "file_created",
    }),
} as const;

function typeOfMedia(filePath: string): MediaType {
    if (isHeicFile(filePath)) {
        return "heic";
    }
    if (isSupportedVideoFile(filePath)) {
        return "video";
    }
    if (isRawFile(filePath)) {
        return "raw";
    }
    if (isImageFile(filePath)) {
        return "image";
    }
    if (isPsdFile(filePath)) {
        return "psd";
    }
    return "other";
}

/**
 * 统一的元数据提取入口（纯函数版本）
 * 根据文件类型自动选择合适的提取器
 */
export async function extractMetadata(
    request: MetadataRequest,
    logger: PhotasaLogger,
): Promise<FileMetadata> {
    const { filePath } = request;
    const ext = path.extname(filePath).toLowerCase();

    logger.info(`[extractMetadata] Processing file: ${filePath} with ext as ${ext}`);

    try {
        // 获取基本文件信息
        const stats = await fs.stat(filePath);
        const baseMetadata = {
            path: filePath,
            name: path.basename(filePath),
            size: stats.size,
            modifiedTime: stats.mtime,
            createdTime: stats.birthtime,
        };

        const type = typeOfMedia(filePath);

        const extractor = MediaExtractorTypeMap[type];

        if (extractor) {
            const metadata = await extractor(filePath, logger);
            if (metadata) {
                // Successfully extracted metadata
                return MediaBuilderTypeMap[type](baseMetadata, metadata);
            }
            // Extraction failed, use fallback
        }

        // Fallback
        logger.warn(`[extractMetadata] Metadata extraction failed for ${filePath}, using fallback`);
        // Map media types to fallback types (HEIC and RAW are both image types)
        return createFallbackMetadata(baseMetadata, filePath, stats, type, logger);
    } catch (error) {
        logger.error(`[Metadata] Error extracting metadata from ${filePath}: ${error}`);
        throw error;
    }
}

/**
 * 处理文件组的导入（纯函数版本）
 */
export async function processFileGroup(
    group: FileGroup,
    logger: PhotasaLogger,
): Promise<FileGroup> {
    logger.debug(`[FileGroup] Processing group with ${group.files.length} files`);

    // 确保所有文件的元数据都已提取
    for (const file of group.files) {
        // 只有当文件没有元数据且没有有效日期信息时才提取元数据
        // ✅ 优先使用已存在的元数据，避免重复提取
        if (file.metadata) {
            logger.debug(`[FileGroup] 文件已有元数据: ${file.name}, 跳过重复提取`);
            continue;
        }

        // 检查是否需要提取元数据
        if (!file.dateTime || !isValidDate(file.dateTime)) {
            // 如果文件已经有有效的创建时间，优先使用它
            if (isValidDate(file.createdTime)) {
                logger.debug(`[FileGroup] 文件已有有效创建时间: ${file.name}, 使用创建时间`);
                file.dateTime = file.createdTime;
                file.dateSource = "file_created";
            } else {
                try {
                    logger.debug(`[FileGroup] 为文件提取元数据: ${file.name}`);
                    const metadata = await extractMetadata({ filePath: file.path }, logger);
                    file.metadata = metadata as any; // 类型转换
                    file.dateTime = metadata.dateTime || file.createdTime;
                    file.dateSource = metadata.dateSource;
                    logger.debug(
                        `[FileGroup] 元数据提取成功: ${file.name}, dateSource: ${file.dateSource}`,
                    );
                } catch (error) {
                    logger.warn(
                        `[FileGroup] Failed to extract metadata for ${file.path}: ${error}`,
                    );
                    // 使用智能日期回退：选择创建时间和修改时间中较早的
                    const fallback = computeFallbackDate(
                        file.createdTime,
                        file.modifiedTime,
                        logger,
                    );
                    file.dateTime = fallback.date;
                    // 映射 current_date 到 file_created 以符合 DateSource 类型
                    file.dateSource =
                        fallback.source === "current_date" ? "file_created" : fallback.source;
                    logger.debug(
                        `[FileGroup] 使用智能回退: ${file.name}, dateSource: ${file.dateSource}, dateTime: ${file.dateTime.toISOString()}`,
                    );
                }
            }
        } else {
            logger.debug(
                `[FileGroup] 文件已有有效日期: ${file.name}, dateSource: ${file.dateSource}`,
            );
        }
    }

    // 确定文件组的目标日期
    const targetDate = determineGroupTargetDate(group, logger);

    // 生成目标路径：YYYY/YYYYMMDD 格式
    group.targetPath = generateDatePath(targetDate);

    return group;
}

/**
 * 确定文件组的目标日期（纯函数）
 */
function determineGroupTargetDate(group: FileGroup, logger: PhotasaLogger): Date {
    const mainFile = group.mainFile;
    let targetDate: Date;
    let dateReason = "";

    // 第一优先级：使用EXIF或其他元数据日期
    if (isValidDate(mainFile.dateTime)) {
        targetDate = mainFile.dateTime as Date;
        dateReason = `using metadata date (${mainFile.dateSource || "unknown source"})`;
    }
    // 第二优先级：使用文件创建时间
    else if (isValidDate(mainFile.createdTime)) {
        targetDate = mainFile.createdTime as Date;
        dateReason = "using file created time";
    }
    // 最后回退：使用智能日期回退
    else {
        const fallback = computeFallbackDate(mainFile.createdTime, mainFile.modifiedTime, logger);
        targetDate = fallback.date;
        dateReason = `using ${fallback.source} as last resort`;
        logger.warn(`[FileGroup] No valid date found for ${mainFile.name}, ${dateReason}`);
    }

    logger.debug(
        `[FileGroup] Selected date for ${mainFile.name}: ${targetDate.toISOString()}, ${dateReason}`,
    );

    return targetDate;
}

// 重新导出所有提取器和解析器
export * from "./extractors/heic-extractor";
export * from "./extractors/video-extractor";
export * from "./extractors/raw-extractor";
export * from "./extractors/image-extractor";
export * from "./parsers/gps-parser";
export * from "./parsers/camera-parser";
export * from "./parsers/date-parser";
