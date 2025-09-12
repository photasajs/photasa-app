export function normalizePath(path: string) {
    return window.api.normalizePath(path);
}
export function mergePath(left: string, right = "") {
    return window.api.mergePath(left, right);
}
export function splitPath(path: string) {
    return window.api.splitPath(path);
}
export function joinPath(...parts: string[]) {
    return window.api.joinPath(...parts);
}
export function getSeparator() {
    return window.api.getSeparator();
}
export function toFileName(path: string) {
    return window.api.toFileName(path);
}
export function toDirName(path: string) {
    return window.api.toDirName(path);
}
export function isFileUnderFolder(file: string, folder: string) {
    return window.api.isFileUnderFolder(file, folder);
}
export function isHiddenFile(path: string) {
    return window.api.isHiddenFile(path);
}
export function isAbsolutePath(path: string) {
    return window.api.isAbsolutePath(path);
}
export function relativePath(from: string, to: string) {
    return window.api.relativePath(from, to);
}
export function resolvePath(...segments: string[]) {
    return window.api.resolvePath(...segments);
}
export function getRoot(path: string) {
    return window.api.getRoot(path);
}

/**
 * 打开文件夹 - 直接调用 preload 层函数，让 preload 层处理 file:// URL 转换
 * @param path 文件夹路径（可能是 file:// URL 或普通路径）
 */
export function openInFinder(path: string): void {
    // 直接调用 preload 层的 openInFinder，让它处理 file:// URL 转换
    window.api.openInFinder(path);
}
