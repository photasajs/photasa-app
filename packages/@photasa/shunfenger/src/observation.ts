import path from "path";
import { generateOperationId } from "@photasa/common";
import type { FileObservation, WatchEventKind } from "./types";

/** 常见媒体扩展名，用于标记非媒体文件供下游过滤 */
const MEDIA_EXTENSIONS = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tiff",
    ".tif",
    ".heic",
    ".heif",
    ".avif",
    ".mp4",
    ".mov",
    ".m4v",
    ".avi",
    ".mkv",
    ".webm",
    ".wmv",
    ".flv",
    ".3gp",
    ".raw",
    ".cr2",
    ".nef",
    ".arw",
    ".dng",
]);

/** 根据扩展名判断是否为媒体文件 */
export function isMediaFile(filePath: string): boolean {
    return MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/** 将 chokidar 事件归一化为 FileObservation */
export function createObservationFromChokidar(
    kind: WatchEventKind,
    filePath: string,
    isDirectory: boolean,
    profileId: string,
): FileObservation {
    return {
        id: generateOperationId(),
        path: filePath,
        kind,
        isDirectory,
        isMediaFile: !isDirectory && isMediaFile(filePath),
        detectedAt: Date.now(),
        profileId,
    };
}
