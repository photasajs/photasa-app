import type { FolderNode } from "@photasa/common";
import { canonicalFolderPath, joinFolderSegment } from "@renderer/utils/folder-tree-path";

/**
 * 收集文件夹路径在树中可见所需的祖先节点 key（不含自身）
 */
export function collectAncestorKeys(folderPath: string, rootPaths: readonly string[]): string[] {
    const normalizedFolder = canonicalFolderPath(folderPath);
    if (!normalizedFolder) {
        return [];
    }

    const normalizedRoots = rootPaths.map(canonicalFolderPath).filter(Boolean);
    const root = normalizedRoots.find(
        (rp) => normalizedFolder === rp || normalizedFolder.startsWith(`${rp}/`),
    );
    if (!root) {
        return [];
    }

    const keys: string[] = [root];
    if (normalizedFolder === root) {
        return keys;
    }

    const relative = normalizedFolder.slice(root.length + 1);
    const parts = relative.split("/").filter(Boolean);
    let current = root;

    for (const part of parts) {
        current = joinFolderSegment(current, part);
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

/**
 * 为当前文件夹合并展开 key（启动恢复 / 切换目录时保证祖先节点可见）
 * RFC 0013：选中态；RFC 0047：folderTree 自 photasa.json 恢复后需展开到 currentFolder
 */
export function mergeExpandedKeysForCurrentFolder(
    currentExpanded: readonly string[],
    folderPath: string,
    rootPaths: readonly string[],
): string[] {
    const normalized = canonicalFolderPath(folderPath);
    if (!normalized) {
        return [...currentExpanded];
    }

    return mergeExpandedKeysForNewFolders(currentExpanded, [normalized], rootPaths);
}
