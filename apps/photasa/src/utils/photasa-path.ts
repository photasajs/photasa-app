/**
 * Electron path contract for `.photasa.json` thumbnails.
 * Mirrors `apps/desktop/src/shared/path-util.ts` / `@photasa/config-core`.
 */
import { PHOTASA_ORIGINALS } from "@photasa/common";

/** 提取文件名（含扩展名） */
export function toFileNameFromPath(target: string): string {
    if (!target) {
        return "";
    }
    const normalized = target.replace(/\\/g, "/");
    const slash = normalized.lastIndexOf("/");
    return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

/** `thumbnail-{fileName}.png`（不含目录） */
export function toThumbnailName(target: string): string {
    return `thumbnail-${toFileNameFromPath(target)}.png`;
}

/** `.photasaoriginals/thumbnail-{fileName}.png` */
export function toRelativeThumbnailPath(photoPath: string): string {
    return `${PHOTASA_ORIGINALS}/${toThumbnailName(toFileNameFromPath(photoPath))}`;
}

/** 绝对/相对缩略图路径 → `.photasaoriginals/{basename}` */
export function shortenThumbnailName(file: string): string {
    const base = toFileNameFromPath(file);
    return `${PHOTASA_ORIGINALS}/${base}`;
}
