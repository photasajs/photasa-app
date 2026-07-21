import type { FolderNode } from "@photasa/common";
import { mergePath } from "@renderer/utils/api-path";

/**
 * 收集文件夹路径在树中可见所需的祖先节点 key（不含自身）
 */
export function collectAncestorKeys(folderPath: string, rootPaths: readonly string[]): string[] {
    if (!folderPath) {
        return [];
    }

    const root = rootPaths.find((rp) => folderPath === rp || folderPath.startsWith(`${rp}/`));
    if (!root) {
        return [];
    }

    const keys: string[] = [root];
    if (folderPath === root) {
        return keys;
    }

    const relative = folderPath.slice(root.length + 1);
    const parts = relative.split("/").filter(Boolean);
    let current = root;

    for (const part of parts) {
        current = mergePath(current, part);
        keys.push(current);
    }

    // 仅展开祖先，使目标文件夹作为子节点可见
    return keys.slice(0, -1);
}

/**
 * 递归收集文件夹树中所有节点 key
 */
export function collectAllFolderKeys(nodes: FolderNode[]): string[] {
    const keys: string[] = [];

    const walk = (node: FolderNode): void => {
        keys.push(String(node.key));
        node.children?.forEach(walk);
    };

    nodes.forEach(walk);
    return keys;
}

/**
 * 根据新增节点 key 合并应展开的祖先 key
 */
export function mergeExpandedKeysForNewFolders(
    currentExpanded: readonly string[],
    newFolderKeys: readonly string[],
    rootPaths: readonly string[],
): string[] {
    const merged = new Set(currentExpanded);

    for (const folderKey of newFolderKeys) {
        for (const ancestor of collectAncestorKeys(folderKey, rootPaths)) {
            merged.add(ancestor);
        }
    }

    return [...merged];
}
