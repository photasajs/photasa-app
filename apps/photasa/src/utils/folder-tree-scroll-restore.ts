import type { FolderNode } from "@photasa/common";
import type { TreeNode } from "@photasa/base-tree";
import { findTreeNode } from "@photasa/base-tree";
import { canonicalFolderPath } from "@renderer/utils/folder-tree-path";

/** folderTree 从空加载完成时的前一长度 */
export const FOLDER_TREE_EMPTY_LENGTH = 0;

/**
 * 是否应在 folderTree 首次有数据时补一次启动滚动恢复
 */
export function shouldScrollOnFolderTreePopulated(
    length: number,
    previousLength: number,
    currentFolder: string,
): boolean {
    return (
        length > FOLDER_TREE_EMPTY_LENGTH &&
        previousLength === FOLDER_TREE_EMPTY_LENGTH &&
        Boolean(canonicalFolderPath(currentFolder))
    );
}

/**
 * 启动恢复滚动门禁：用户已操作树或已完成恢复后不再自动 scrollToNode
 */
export function canAttemptScrollRestore(didRestoreScrollIntoView: boolean): boolean {
    return !didRestoreScrollIntoView;
}

/**
 * 目标文件夹是否已在树中可见（可安全 scrollToNode）
 */
export function isFolderPresentInTree(folderPath: string, tree: readonly FolderNode[]): boolean {
    const normalized = canonicalFolderPath(folderPath);
    if (!normalized) {
        return false;
    }
    return Boolean(findTreeNode(normalized, tree as TreeNode[]));
}
