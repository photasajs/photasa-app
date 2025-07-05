import path from "path";
import { PHOTASA_ORIGINALS } from "@common/utils";
import fs from "fs";

/**
 * 缩短缩略图绝对路径为相对路径
 * @param file - 缩略图绝对路径
 * @returns 相对路径
 */
export function shortenThumbnailName(file: string): string {
    return path.join(PHOTASA_ORIGINALS, path.basename(file));
}

/**
 * 将原始文件名转换为缩略图文件名（带路径）
 * @param target - 原始文件名
 * @returns 缩略图文件名（带路径）
 */
export function toThumbnailName(target: string): string {
    return path.join(PHOTASA_ORIGINALS, `${toFileName(target)}.png`);
}

/**
 * 构建预览图路径
 * @param target - 原始文件路径
 * @returns 预览图路径
 */
export function toPreviewPath(target: string): string {
    const fileName = path.basename(target, path.extname(target));
    return path.join(path.dirname(target), PHOTASA_ORIGINALS, `${fileName}.jpeg`);
}

/**
 * 构建缩略图文件的相对路径
 * @param photoPath - 原始照片路径
 * @returns 缩略图文件的相对路径
 */
export function toRelativeThumbnailPath(photoPath: string): string {
    return path.join(PHOTASA_ORIGINALS, toThumbnailName(path.basename(photoPath)));
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
 * 判断文件是否在指定文件夹下（仅依赖 path 包）
 * @param file 文件路径
 * @param folder 文件夹路径
 * @returns 是否在文件夹下
 */
export function isFileUnderFolder(file: string, folder: string): boolean {
    if (!file || !folder) {
        return false;
    }
    const fileDir = path.resolve(path.dirname(file));
    const folderDir = path.resolve(folder);
    return fileDir === folderDir;
}

/**
 * 提取文件名（含扩展名），仅依赖 path 包
 * @param target 文件完整路径
 * @returns 文件名（含扩展名）
 */
export function toFileName(target: string): string {
    if (!target) {
        return "";
    }
    return path.basename(target);
}

/**
 * 提取目录名，仅依赖 Node.js path 包
 * @param target 文件或目录路径
 * @returns 目录名
 */
export function toDirName(target: string): string {
    return path.dirname(target);
}

/**
 * 提取扩展名，仅依赖 Node.js path 包
 * @param target 文件路径
 * @returns 扩展名（含点）
 */
export function toExtName(target: string): string {
    return path.extname(target);
}

/**
 * 计算相对路径，仅依赖 Node.js path 包
 * @param from 起始路径
 * @param to 目标路径
 * @returns 相对路径
 */
export function relativePath(from: string, to: string): string {
    return path.relative(from, to);
}

/**
 * 解析绝对路径，仅依赖 Node.js path 包
 * @param segments 路径片段
 * @returns 绝对路径
 */
export function resolvePath(...segments: string[]): string {
    return path.resolve(...segments);
}

/**
 * 判断是否为绝对路径，仅依赖 Node.js path 包
 * @param target 路径
 * @returns 是否为绝对路径
 */
export function isAbsolutePath(target: string): boolean {
    return path.isAbsolute(target);
}

/**
 * 归一化路径，完全依赖 Node.js path 包
 * @param p 路径字符串
 * @returns 归一化后的路径
 */
export function normalizePath(p: string): string {
    return path.normalize(p);
}

/**
 * 路径拼接，完全依赖 Node.js path 包
 * @param left 左侧路径
 * @param right 右侧路径（可选）
 * @returns 拼接后的路径
 */
export function mergePath(left: string, right = ""): string {
    return path.join(left, right);
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

/**
 * 判断路径是否为目录，仅依赖 Node.js fs.promises
 * @param path 路径
 * @returns 是否为目录
 */
export async function isDirectory(path: string): Promise<boolean> {
    try {
        const stat = await fs.promises.stat(path);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

/**
 * 判断路径是否为文件，仅依赖 Node.js fs.promises
 * @param path 路径
 * @returns 是否为文件
 */
export async function isFile(path: string): Promise<boolean> {
    try {
        const stat = await fs.promises.stat(path);
        return stat.isFile();
    } catch {
        return false;
    }
}
