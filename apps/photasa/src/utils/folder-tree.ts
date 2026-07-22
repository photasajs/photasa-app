import type { FolderNode } from "@photasa/common";
import { splitPath } from "@renderer/utils/api-path";
import type { Photo } from "@photasa/common";
import {
    buildFolderKey,
    canonicalFolderPath,
    findLongestRootKey,
    folderSegmentsUnderRoot,
    resolveFolderNodeKey,
} from "@renderer/utils/folder-tree-path";
import { toDirNameSync } from "@renderer/utils/sync-path";

/** 文件路径取父目录；已是目录路径则原样返回 */
function directoryPathForFolderTree(filePath: string): string {
    const raw = canonicalFolderPath(filePath);
    const basename = raw.split("/").pop() || "";
    if (/\.[a-zA-Z0-9]+$/i.test(basename)) {
        return toDirNameSync(raw);
    }
    return raw;
}

function normalizeRoot(root: FolderNode): void {
    if (!root.children) {
        root.children = [];
    }
}

/**
 * 添加根节点到文件夹树
 */
export function addRoot(roots: FolderNode[], rootPath: string): void {
    const key = canonicalFolderPath(rootPath);
    if (!key) {
        return;
    }
    const exists = roots.some((node) => canonicalFolderPath(String(node.key)) === key);
    if (exists) {
        return;
    }
    roots.push({
        key,
        title: key,
        children: [],
    });
    roots.sort((item1, item2) => item1.key.toString().localeCompare(item2.key.toString()));
}

/**
 * 从文件夹树移除根节点
 */
export function removeRoot(roots: FolderNode[], rootPath: string): void {
    const key = canonicalFolderPath(rootPath);
    const index = roots.findIndex((node) => canonicalFolderPath(String(node.key)) === key);
    if (index >= 0) {
        roots.splice(index, 1);
    }
}

/**
 * 清理文件夹树中的数据节点
 */
export function cleanDataNode(roots: FolderNode[], file: Photo): void {
    const filePath = canonicalFolderPath(file.path);
    const pathParts = splitPath(filePath).filter((part: string) => part !== "");
    if (pathParts.length <= 1) {
        return;
    }

    const rootKey = findLongestRootKey(
        filePath,
        roots.map((node) => String(node.key)),
    );
    const root = roots.find((node) => String(node.key) === rootKey);
    if (!root?.children) {
        return;
    }
    cleanChild(root.children, file, filePath);
}

function cleanChild(nodes: FolderNode[], file: Photo, filePath: string): void {
    const index = nodes.findIndex((child) => canonicalFolderPath(String(child.key)) === filePath);
    if (index >= 0) {
        nodes.splice(index, 1);
        return;
    }

    const parentKey = findLongestRootKey(
        filePath,
        nodes.map((node) => String(node.key)),
    );
    const parent = nodes.find((node) => String(node.key) === parentKey);
    if (parent?.children) {
        cleanChild(parent.children, file, filePath);
    }
}

/**
 * 向文件夹树添加文件夹节点（目录路径或文件路径均可）
 */
export function addFolderToTree(roots: FolderNode[], file: Photo): void {
    if (!file?.path || typeof file.path !== "string") {
        return;
    }
    const folderPath = directoryPathForFolderTree(file.path);
    if (!folderPath) {
        return;
    }

    const rootKey = findLongestRootKey(
        folderPath,
        roots.map((node) => String(node.key)),
    );
    if (!rootKey) {
        return;
    }

    const root = roots.find((node) => canonicalFolderPath(String(node.key)) === rootKey);
    if (!root) {
        return;
    }

    const segments = folderSegmentsUnderRoot(folderPath, rootKey);
    if (segments.length === 0 || segments.some((s) => s.startsWith("."))) {
        return;
    }

    traverseTree(root, segments);
}

function traverseTree(root: FolderNode, segments: string[]): FolderNode {
    normalizeRoot(root);
    if (segments.length === 0) {
        return root;
    }

    const childKey = buildFolderKey(String(root.key), [segments[0]]);
    let child = root.children?.find(
        (node) => resolveFolderNodeKey(String(root.key), node) === childKey,
    );

    if (!child) {
        child = {
            key: childKey,
            title: segments[0],
            children: [],
        };
        root.children?.push(child);
        root.children = root.children?.sort((item1, item2) =>
            item1.key.toString().localeCompare(item2.key.toString()),
        );
    } else {
        child.key = childKey;
    }

    return traverseTree(child, segments.slice(1));
}

function dedupeSiblingNodes(parentKey: string | null, children: FolderNode[]): FolderNode[] {
    const grouped = new Map<string, FolderNode>();

    for (const child of children) {
        let resolved: string | null;
        if (parentKey === null) {
            resolved = canonicalFolderPath(child.key);
        } else {
            resolved = resolveFolderNodeKey(parentKey, child);
        }
        if (!resolved) {
            continue;
        }

        child.key = resolved;
        if (typeof child.title !== "string" || !child.title.trim()) {
            child.title = resolved.split("/").pop() || resolved;
        }

        child.children = child.children?.length ? dedupeSiblingNodes(resolved, child.children) : [];

        const existing = grouped.get(resolved);
        if (!existing) {
            grouped.set(resolved, child);
            continue;
        }

        existing.children = dedupeSiblingNodes(resolved, [
            ...(existing.children ?? []),
            ...(child.children ?? []),
        ]);
    }

    return [...grouped.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

/**
 * 规范化 key、合并重复兄弟节点（含 `{}` / 段名 / 全路径混用）
 */
export function sanitizeFolderTree(roots: FolderNode[]): void {
    const sanitized = dedupeSiblingNodes(null, roots);
    roots.splice(0, roots.length, ...sanitized);
}

/** @deprecated 使用 sanitizeFolderTree */
export function dedupeFolderTree(roots: FolderNode[]): void {
    sanitizeFolderTree(roots);
}
