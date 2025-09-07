import { readChunk } from "read-chunk";
import imageType, { minimumBytes } from "image-type";
import { electronAPI } from "@electron-toolkit/preload";
import type { ImageInfo, ImageTypeResult } from "@common/types";
import type { FileMetadata, DateSource } from "@common/import-types";
import type { ThumbnailRequest } from "@common/thumbnail-types";
import { getExifInfo } from "./exif-helper";
import { extractDateTimeFromExif, EXIF_DATE_FIELDS } from "@common/exif-util";
import isVideo from "is-video";
import isImage from "is-image";
import { ThumbnailServiceAction } from "@common/thumbnail-types";
import fs from "fs-extra";
import path from "path";
import { loggers } from "@common/logger";

const { ipcRenderer } = electronAPI;
const logger = loggers.preload;

/**
 * 将 file:// URL 转换为文件系统路径
 * @param fileUrl - file:// URL 或普通路径
 * @returns 文件系统路径
 */
function fileUrlToPath(fileUrl: string): string {
    if (fileUrl.startsWith("file://")) {
        // 移除 file:// 前缀并处理编码
        let path = decodeURIComponent(fileUrl.replace(/^file:\/\//, ""));

        // Windows 路径处理 - 移除前导斜杠
        if (process.platform === "win32" && path.startsWith("/") && path[2] === ":") {
            path = path.substring(1);
        }

        return path;
    }
    return fileUrl;
}

/**
 * 获取图片类型（保持向后兼容）
 * @param pathOrUrl - 文件路径或 file:// URL
 * @returns 图片类型信息
 */
export async function getImageType(pathOrUrl: string): Promise<ImageInfo> {
    const filePath = fileUrlToPath(pathOrUrl);
    const buffer = await readChunk(filePath, { length: minimumBytes });
    const tags = await getExifInfo(filePath);
    const result = await imageType(buffer);
    return {
        imageType: (result ?? "unknown") as ImageTypeResult,
        tags,
    };
}

/**
 * 获取文件元数据（统一处理图片/视频/文件信息）
 * @param pathOrUrl - 文件路径或 file:// URL
 * @returns 文件元数据，包含图片/视频信息或文件基础信息
 */
export async function getFileMetadata(pathOrUrl: string): Promise<FileMetadata> {
    const filePath = fileUrlToPath(pathOrUrl);
    const fileName = path.basename(filePath);

    try {
        // 获取文件基础信息
        const stats = await fs.stat(filePath);
        const fileSize = stats.size;
        const modifiedTime = stats.mtime;
        const createdTime = stats.birthtime || stats.ctime;

        // 确定文件类型
        const isImageFile = isImage(filePath);
        const isVideoFile = isVideo(filePath);

        let fileType: "image" | "video" | "other" = "other";
        let dateTime: Date | undefined;
        let dateSource: DateSource = "file_created";
        let format: string | undefined;
        let width: number | undefined;
        let height: number | undefined;
        let duration: number | undefined;

        if (isImageFile) {
            fileType = "image";
            try {
                // 尝试提取图片元数据
                const buffer = await readChunk(filePath, { length: minimumBytes });
                const imageTypeResult = await imageType(buffer);
                const exifTags = await getExifInfo(filePath);

                format =
                    imageTypeResult?.ext?.toUpperCase() ||
                    path.extname(filePath).slice(1).toUpperCase();

                if (exifTags) {
                    // 提取 EXIF 日期
                    const exifDateTime = extractDateTimeFromExif(exifTags, EXIF_DATE_FIELDS);
                    if (exifDateTime) {
                        dateTime = exifDateTime;
                        dateSource = "exif";
                    }

                    // 提取图片尺寸
                    const widthValue =
                        exifTags["Image Width"]?.value || exifTags["PixelXDimension"]?.value;
                    const heightValue =
                        exifTags["Image Height"]?.value || exifTags["PixelYDimension"]?.value;

                    // 确保尺寸为数字类型
                    width = typeof widthValue === "number" ? widthValue : undefined;
                    height = typeof heightValue === "number" ? heightValue : undefined;
                }
            } catch (error) {
                // 图片元数据提取失败，使用文件信息
                logger.warn(`Failed to extract image metadata for ${filePath}:`, error);
            }
        } else if (isVideoFile) {
            fileType = "video";
            format = path.extname(filePath).slice(1).toUpperCase();
            // TODO: 实现视频元数据提取
            // 暂时使用文件修改时间
        }

        // 如果没有从元数据中获取到日期，使用文件时间
        if (!dateTime) {
            dateTime = createdTime;
            dateSource = "file_created";
        }

        return {
            path: filePath,
            name: fileName,
            size: fileSize,
            type: fileType,
            modifiedTime,
            createdTime,
            dateTime,
            dateSource,
            format,
            width,
            height,
            duration,
        };
    } catch (error) {
        logger.error(`Failed to get file metadata for ${filePath}:`, error);
        throw error;
    }
}

/**
 * 获取文件 URL
 * @param path - 路径
 * @returns 文件 URL
 */
export function fileUrlFromPath(path: string): string {
    // Original code from https://github.com/sindresorhus/file-url/blob/master/index.js
    // (But without dependency to node.js)

    // Replace backslashes with forward slashes
    path = path.replace(/\\/g, "/");

    // Check if the path is an absolute URL
    if (path[0] !== ".") {
        // This is an absolute URL
        if (path[0] !== "/") {
            // Windows drive letter must be prefixed with a slash
            path = `///${path}`;
        } else {
            path = `//${path}`;
        }
    }

    // Escape required characters for path components
    // See: https://tools.ietf.org/html/rfc3986#section-3.3
    return encodeURI(`file:${path}`).replace(/[?#]/g, encodeURIComponent);
}

/**
 * 创建缩略图
 * @param request - 请求
 * @returns 请求
 */
export function createThumbnail(request: ThumbnailRequest): Promise<ThumbnailRequest> {
    // 调用 thumbnail-service 创建缩略图
    return ipcRenderer.invoke(ThumbnailServiceAction.create, request);
}

/**
 * 删除缩略图
 * @param request - 请求
 * @returns 请求
 */
export function removeThumbnail(request: ThumbnailRequest): Promise<ThumbnailRequest> {
    // 调用 thumbnail-service 删除缩略图
    return ipcRenderer.invoke(ThumbnailServiceAction.remove, request);
}

/**
 * 判断是否是视频文件
 * @param filePath - 文件路径
 * @returns 是否是视频文件
 */
export function isVideoFile(filePath: string): boolean {
    return isVideo(filePath);
}

/**
 * 判断是否是图片文件
 * @param filePath - 文件路径
 * @returns 是否是图片文件
 */
export function isImageFile(filePath: string): boolean {
    return isImage(filePath);
}
