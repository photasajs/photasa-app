import config from "./config";
import type { VideoSize } from "./types";

export const PHOTASA_ORIGINALS = ".photasaoriginals";
export const HeicExtensionRE = new RegExp(`\.(${config.acceptedHeicExtensions.join("|")})$`, "i");

/**
 * 将原始文件名转换为缩略图文件名（不含路径）
 * @param photoPath - 原始文件名
 * @returns 缩略图文件名
 */
export function toThumbnailPath(photoPath: string): string {
    return `thumbnail-${photoPath}.png`;
}

export function ratioStringToParts(str: string): number[] {
    return str.split(":").map((n: string): number => parseInt(n, 10));
}

export function getOptimalThumbnailResolution(
    videoDimension: VideoSize,
    arg: { width: number; height: number },
): VideoSize {
    if (videoDimension.width > videoDimension.height) {
        return {
            width: arg.width,
            height: Math.round((arg.width * videoDimension.height) / videoDimension.width),
        };
    } else {
        return {
            width: Math.round((arg.height * videoDimension.width) / videoDimension.height),
            height: arg.height,
        };
    }
}

/**
 * 判断路径是否为 Photasa 路径
 * @param photoPath 路径
 * @returns 是否为 Photasa 路径
 */
export function shouldIgnorePhotasaPath(photoPath: string): boolean {
    return (
        photoPath.indexOf(".photasaoriginals") >= 0 ||
        photoPath.indexOf(".picasaoriginals") >= 0 ||
        photoPath.indexOf(".photasaoriginal") >= 0 ||
        photoPath.indexOf(".picasaoriginal") >= 0 ||
        photoPath.indexOf(".photasa.json") >= 0 ||
        photoPath.indexOf(".AppleDouble") >= 0
    );
}
