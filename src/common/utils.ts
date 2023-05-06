/// <reference types="./types" />

import path from "path";
import config from "./config";

export const PHOTASA_ORIGINALS = ".photasaoriginals";
export const HeicExtensionRE = new RegExp(`\\.(${config.acceptedHeicExtensions.join("|")})$`, "i");

function toThumbnailPath(photoPath: string): string {
    return `thumbnail-${photoPath}.png`;
}
export function buildThumbnailPath(photoPath: string): string {
    // Prepare thumbnail path for image
    const dir = path.join(path.dirname(photoPath), PHOTASA_ORIGINALS);
    return path.join(dir, toThumbnailPath(path.basename(photoPath)));
}

export function toRelativeThumbnailPath(photoPath: string): string {
    return path.join(PHOTASA_ORIGINALS, toThumbnailPath(path.basename(photoPath)));
}

export function toPreviewPath(target: string): string {
    const fileName = path.basename(target, path.extname(target));
    return path.join(path.dirname(target), `${PHOTASA_ORIGINALS}`, `${fileName}.jpeg`);
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

export function isHiddenFile(file: string): boolean {
    const basename = path.basename(file);
    return basename.startsWith(".");
}

export function shouldIgnorePhotasaPath(photoPath: string): boolean {
    return (
        photoPath.indexOf(".photasaoriginals") >= 0 ||
        photoPath.indexOf(".picasaoriginals") >= 0 ||
        photoPath.indexOf(".photasaoriginal") >= 0 ||
        photoPath.indexOf(".picasaoriginal") >= 0 ||
        photoPath.indexOf(".AppleDouble") >= 0
    );
}

export function isFileUnderFolder(file: string, folder: string): boolean {
    const dirname = path.dirname(file);
    return dirname === path.normalize(folder);
}

/**
 * Shorten to file name (include extension)
 * @param target file full path
 * @returns file name only (include extension)
 */
export function toFileName(target: string): string {
    return path.basename(target);
}

/**
 * Convert a given photo file name to thumbnail file name
 *
 * @param target original photo file name
 * @returns thumbnail file name
 */
export function toThumbnailName(target: string): string {
    return path.join(PHOTASA_ORIGINALS, `${toFileName(target)}.png`);
}

/**
 * Shorten thumbnail absolute file name to relative file name
 * @param file absolute thumbnail file name
 * @returns relative file name
 */
export function shortenThumbnailName(file: string): string {
    return path.join(PHOTASA_ORIGINALS, path.basename(file));
}
