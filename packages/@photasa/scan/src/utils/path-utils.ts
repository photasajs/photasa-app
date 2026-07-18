/**
 * path-utils.ts
 *
 * 扫描模块内部路径工具函数
 * 这些函数来自 apps/desktop/src/shared/path-util.ts，在提取包时内联
 */

import path from "path";
import { PHOTASA_ORIGINALS } from "@photasa/common";

/**
 * 将原始文件名转换为缩略图文件名（不含路径）
 * @param target - 原始文件名（仅文件名，不含目录）
 * @returns 缩略图文件名（不含路径）
 */
function toThumbnailName(target: string): string {
    return `thumbnail-${target}.png`;
}

/**
 * 构建缩略图文件的绝对路径
 * @param photoPath - 原始照片路径
 * @returns 缩略图文件的绝对路径
 */
export function buildThumbnailPath(photoPath: string): string {
    const dir = path.normalize(path.join(path.dirname(photoPath), PHOTASA_ORIGINALS));
    return path.join(dir, toThumbnailName(path.basename(photoPath)));
}

/**
 * 判断是否为隐藏文件，仅依赖 Node.js path 包
 * @param file 文件路径
 * @returns 是否为隐藏文件
 */
export function isHiddenFile(file: string): boolean {
    const basename = path.basename(file);
    return basename.startsWith(".");
}
