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
import { getPhotasaApi } from "@renderer/ipc/api-access";
import { isTauri } from "@renderer/api/env";

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

export function isFileUnderFolder(file: string, folder: string) {
    if (!isTauri()) {
        return getPhotasaApi().isFileUnderFolder(file, folder) as boolean;
    }
    return getPhotasaApi().isFileUnderFolder(file, folder);
}

export function isHiddenFile(path: string) {
    return isHiddenFileSync(path);
}

export function isAbsolutePath(path: string) {
    return isAbsolutePathSync(path);
}

export function relativePath(from: string, to: string) {
    return getPhotasaApi().relativePath(from, to);
}

export function resolvePath(...segments: string[]) {
    return getPhotasaApi().resolvePath(...segments);
}

export function getRoot(path: string) {
    return getPhotasaApi().getRoot(path);
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
