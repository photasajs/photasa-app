/**
 * 文件夹树辅助函数（纯函数）
 * 用于处理文件夹树相关的逻辑，无副作用，易于测试
 *
 * @description
 * 纯函数设计，专注于业务逻辑，不依赖外部状态
 *
 * @since 2025-01-23
 */

import type { FolderNode } from "@photasa/common";

/**
 * 检查路径是否是根路径
 *
 * @param folderPath 要检查的路径
 * @param rootPaths 根路径数组
 * @returns 是否是根路径
 */
export function isRootPath(folderPath: string, rootPaths: string[]): boolean {
    return rootPaths.includes(folderPath);
}

/**
 * 查找路径对应的根路径
 *
 * @param folderPath 要查找的路径
 * @param rootPaths 根路径数组
 * @returns 对应的根路径，如果找不到则返回 null
 */
export function findRootPathForPath(folderPath: string, rootPaths: string[]): string | null {
    return rootPaths.find((rp) => folderPath.startsWith(rp + "/") || folderPath === rp) || null;
}

/**
 * 检查根节点是否已存在于树中
 *
 * @param tree 文件夹树
 * @param rootPath 根路径
 * @returns 根节点是否存在
 */
export function isRootNodeExists(tree: FolderNode[], rootPath: string): boolean {
    return tree.some((node) => node.key === rootPath);
}

/**
 * 确定需要添加的根路径（如果路径是根路径或其父根路径不存在）
 *
 * @param folderPath 要添加的路径
 * @param rootPaths 根路径数组
 * @param tree 当前文件夹树
 * @returns 需要添加的根路径，如果不需要则返回 null
 */
export function determineRootPathToAdd(
    folderPath: string,
    rootPaths: string[],
    tree: FolderNode[],
): string | null {
    // 如果是根路径，检查是否需要添加
    if (isRootPath(folderPath, rootPaths)) {
        if (!isRootNodeExists(tree, folderPath)) {
            return folderPath;
        }
        return null;
    }

    // 如果是子路径，找到对应的根路径并检查是否需要添加
    const rootPath = findRootPathForPath(folderPath, rootPaths);
    if (rootPath && !isRootNodeExists(tree, rootPath)) {
        return rootPath;
    }

    return null;
}
