import type { FolderNode } from "@photasa/common";
import { addFolderToTree, addRoot } from "@renderer/utils/folder-tree";
import { canonicalFolderPath } from "@renderer/utils/folder-tree-path";
import { determineRootPathToAdd } from "@renderer/services/weizheng/folder-tree-helpers";

/**
 * 将扫描/rescan 发现的目录路径批量合并进 folderTree（纯函数，供测试与魏征共用）
 */
export function mergeDiscoveredPathsIntoTree(
    tree: FolderNode[],
    discoveredPaths: readonly string[],
    watchRootPaths: readonly string[],
): FolderNode[] {
    for (const rawPath of discoveredPaths) {
        if (!rawPath || typeof rawPath !== "string") {
            continue;
        }

        const normalizedPath = canonicalFolderPath(rawPath);
        if (normalizedPath.split("/").some((part) => part.startsWith("."))) {
            continue;
        }
        const rootToAdd = determineRootPathToAdd(normalizedPath, [...watchRootPaths], tree);
        if (rootToAdd) {
            addRoot(tree, rootToAdd);
        }

        addFolderToTree(tree, {
            path: normalizedPath,
            thumbnail: "",
            isVideo: false,
        });
    }

    return tree;
}

/**
 * 模拟 rescan 分阶段 directory 报告（父目录扫一层 → 子目录再扫一层）
 */
export function simulateRescanDirectoryDiscoveries(
    watchRoot: string,
    discoveriesByScanRoot: Readonly<Record<string, readonly string[]>>,
): string[] {
    const ordered: string[] = [];
    const scanRoots = [
        canonicalFolderPath(watchRoot),
        ...Object.keys(discoveriesByScanRoot).map(canonicalFolderPath),
    ];

    for (const scanRoot of scanRoots) {
        const dirs = discoveriesByScanRoot[scanRoot];
        if (!dirs) {
            continue;
        }
        for (const dir of dirs) {
            ordered.push(canonicalFolderPath(dir));
        }
    }

    return ordered;
}
