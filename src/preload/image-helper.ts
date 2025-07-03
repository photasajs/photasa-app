import { readChunk } from "read-chunk";
import imageType, { minimumBytes } from "image-type";
import { electronAPI } from "@electron-toolkit/preload";
import type { ImageInfo, ImageTypeResult } from "@common/types";
import type { ThumbnailRequest } from "@common/thumbnail-types";
import { getExifInfo } from "./exif-helper";
import isVideo from "is-video";
import isImage from "is-image";
import { ThumbnailServiceAction } from "@common/thumbnail-types";

const { ipcRenderer } = electronAPI;

/**
 * 获取图片类型
 * @param path - 路径
 * @returns 图片类型
 */
export async function getImageType(path: string): Promise<ImageInfo> {
    const buffer = await readChunk(path, { length: minimumBytes });
    const tags = await getExifInfo(path);
    const result = await imageType(buffer);
    return {
        imageType: (result ?? "unknown") as ImageTypeResult,
        tags,
    };
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
