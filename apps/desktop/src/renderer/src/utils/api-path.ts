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

import { useZhangSunWuJi } from "@renderer/composables/useZhangSunWuJi";

/**
 * 打开文件夹 - 通过长孙无忌服务，使用 qizou 流程
 * @param path 文件夹路径（可能是 file:// URL 或普通路径）
 *
 * 注意：此函数现在通过 qizou-shengzhi 流程处理：
 * 长孙无忌 → 房玄龄 → 袁天罡 → 天枢引擎工作流 → 太白金星适配器
 *
 * 如果需要 file:// URL 转换，应该在调用此函数前处理
 */
export function openInFinder(path: string): void {
    // ✅ RFC 0058: 使用新的服务架构，通过 qizou 流程
    const zhangSunWuJi = useZhangSunWuJi();
    zhangSunWuJi.openInFinder(path);
}
