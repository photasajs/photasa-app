import { readChunk } from "read-chunk";
import imageType, { minimumBytes } from "image-type";
import { electronAPI } from "@electron-toolkit/preload";
import type { ThumbnailRequest, ImageInfo } from "./types";
import { getExifInfo } from "./exif-helper";
import isVideo from "is-video";
import isImage from "is-image";

const { ipcRenderer } = electronAPI;

export async function getImageType(path: string): Promise<ImageInfo> {
    const buffer = await readChunk(path, { length: minimumBytes });
    const tags = await getExifInfo(path);
    const result = await imageType(buffer);
    return {
        imageType: result,
        tags,
    };
}

export function fileUrlFromPath(path: string): string {
    // Original code from https://github.com/sindresorhus/file-url/blob/master/index.js
    // (But without dependency to node.js)

    path = path.replace(/\\/g, "/");

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

export function createThumbnail(request: ThumbnailRequest): Promise<ThumbnailRequest> {
    return ipcRenderer.invoke("picasa:create-thumbnail", request);
}

export function removeThumbnail(request: ThumbnailRequest): Promise<ThumbnailRequest> {
    // Start file watching
    return ipcRenderer.invoke("picasa:remove-thumbnail", request);
}

export function isVideoFile(filePath: string): boolean {
    return isVideo(filePath);
}

export function isImageFile(filePath: string): boolean {
    return isImage(filePath);
}
