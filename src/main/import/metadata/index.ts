import fs from "fs-extra";
import path from "path";
import { extractHeicMetadata, isHeicFile } from "./extractors/heic-extractor";
import { extractVideoMetadata, isSupportedVideoFile } from "./extractors/video-extractor";
import { extractRawMetadata, isRawFile } from "./extractors/raw-extractor";
import { extractImageMetadata, isImageFile } from "./extractors/image-extractor";
import { generateDatePath, isValidDate, getDateFallback } from "./parsers/date-parser";
import type { PhotasaLogger } from "@common/logger";
import type { MetadataRequest, FileMetadata, FileGroup } from "@common/import-types";

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

        // 根据文件类型提取特定元数据
        if (isHeicFile(filePath)) {
            const heicMetadata = await extractHeicMetadata(filePath, logger);
            return {
                ...baseMetadata,
                ...heicMetadata,
                type: "image" as const,
                // 确保null转换为undefined以符合FileMetadata接口
                dateTime: heicMetadata.dateTime || undefined,
                gpsInfo: heicMetadata.gpsInfo || undefined,
                cameraInfo: heicMetadata.cameraInfo || undefined,
            };
        }

        if (isSupportedVideoFile(filePath)) {
            logger.info(`[extractMetadata] Processing Video File ${filePath}`);
            const videoMetadata = await extractVideoMetadata(filePath, logger);
            return {
                ...baseMetadata,
                ...videoMetadata,
                type: "video" as const,
                // 确保null转换为undefined以符合FileMetadata接口
                dateTime: videoMetadata.creationTime || undefined,
                gpsInfo: videoMetadata.gpsInfo || undefined,
            };
        }

        if (isRawFile(filePath)) {
            const rawMetadata = await extractRawMetadata(filePath, logger);
            return {
                ...baseMetadata,
                ...rawMetadata,
                type: "image" as const,
                // 确保null转换为undefined以符合FileMetadata接口
                dateTime: rawMetadata.dateTime || undefined,
                gpsInfo: rawMetadata.gpsInfo || undefined,
                cameraInfo: rawMetadata.cameraInfo || undefined,
            };
        }

        if (isImageFile(filePath)) {
            const imageMetadata = await extractImageMetadata(filePath, logger);
            return {
                ...baseMetadata,
                ...imageMetadata,
                type: "image" as const,
                dateTime: imageMetadata.dateTime || undefined,
                gpsInfo: imageMetadata.gpsInfo || undefined,
                cameraInfo: imageMetadata.cameraInfo || undefined,
            };
        }

        // 其他文件类型
        return {
            ...baseMetadata,
            type: "other",
            dateTime: stats.birthtime,
            dateSource: "file_created",
        };
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
        if (
            !file.metadata &&
            (!file.dateTime || !isValidDate(file.dateTime)) &&
            !file.createdTime
        ) {
            try {
                const metadata = await extractMetadata({ filePath: file.path }, logger);
                file.metadata = metadata as any; // 类型转换
                file.dateTime = metadata.dateTime || file.createdTime;
                file.dateSource = metadata.dateSource;
            } catch (error) {
                logger.warn(`[FileGroup] Failed to extract metadata for ${file.path}: ${error}`);
                // 使用文件创建时间作为回退
                file.dateTime = file.createdTime;
                file.dateSource = "file_created";
            }
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
        targetDate = mainFile.dateTime!;
        dateReason = `using metadata date (${mainFile.dateSource || "unknown source"})`;
    }
    // 第二优先级：使用文件创建时间
    else if (isValidDate(mainFile.createdTime)) {
        targetDate = mainFile.createdTime!;
        dateReason = "using file created time";
    }
    // 最后回退：使用今天的日期
    else {
        const fallback = getDateFallback(mainFile.createdTime, logger);
        targetDate = fallback.date;
        dateReason = "using today's date as last resort";
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
