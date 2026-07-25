import {
    getSeparatorSync,
    isAbsolutePathSync,
    isHiddenFileSync,
    joinPathSync,
    mergePathSync,
    normalizePathSync,
    shortenThumbnailNameSync,
    splitPathSync,
    toDirNameSync,
    toFileNameSync,
    toThumbnailNameSync,
} from "@renderer/utils/sync-path";
import { useZhangSunWuJi } from "@renderer/composables/useZhangSunWuJi";

export function normalizePath(path: string) {
    return normalizePathSync(path);
}

export function mergePath(left: string, right = "") {
    return mergePathSync(left, right);
}

export function splitPath(path: string) {
    return splitPathSync(path);
}

export function joinPath(...parts: string[]) {
    return joinPathSync(...parts);
}

export function getSeparator() {
    return getSeparatorSync();
}

export function toFileName(path: string) {
    return toFileNameSync(path);
}

export function toDirName(path: string) {
    return toDirNameSync(path);
}

export function isFileUnderFolder(file: string, folder: string): boolean {
    const normFile = normalizePathSync(file);
    const normFolder = normalizePathSync(folder);
    return normFile.startsWith(normFolder.endsWith("/") ? normFolder : `${normFolder}/`);
}

export function isHiddenFile(path: string) {
    return isHiddenFileSync(path);
}

export function isAbsolutePath(path: string) {
    return isAbsolutePathSync(path);
}

export function relativePath(from: string, to: string): string {
    const normFrom = normalizePathSync(from).split("/").filter(Boolean);
    const normTo = normalizePathSync(to).split("/").filter(Boolean);
    let common = 0;
    while (
        common < normFrom.length &&
        common < normTo.length &&
        normFrom[common] === normTo[common]
    ) {
        common++;
    }
    const up = normFrom.length - common;
    const rel = [...Array(up).fill(".."), ...normTo.slice(common)];
    return rel.join("/") || ".";
}

export function resolvePath(...segments: string[]): string {
    return joinPathSync(...segments);
}

export function getRoot(path: string): string {
    const norm = normalizePathSync(path);
    const parts = norm.split("/").filter(Boolean);
    return parts.length > 0 ? `/${parts[0]}` : "/";
}

export function toThumbnailName(path: string) {
    return toThumbnailNameSync(path);
}

export function shortenThumbnailName(path: string) {
    return shortenThumbnailNameSync(path);
}

/**
 * 打开文件夹 - 通过长孙无忌服务，使用 qizou 流程
 */
export function openInFinder(path: string): void {
    const zhangSunWuJi = useZhangSunWuJi();
    zhangSunWuJi.openInFinder(path);
}
