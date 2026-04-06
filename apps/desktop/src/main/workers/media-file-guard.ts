import { isImageFile, isVideoFile } from "@photasa/import";

/** 与 import-worker 的媒体类型判定对齐（扩展名：图片或视频） */
export function isPhotasaMediaFile(filePath: string): boolean {
    return isImageFile(filePath) || isVideoFile(filePath);
}
