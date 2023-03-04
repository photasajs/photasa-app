import type { DataNode } from "ant-design-vue/es/tree";
import { mergePath } from "./path";

const FolderFiles: Record<string, Set<string>> = {};

function updateFileList(key, fileList: Set<string>): void {
    const normalizedKey = mergePath(key, "");
    FolderFiles[normalizedKey] = new Set([...(FolderFiles[normalizedKey] ?? []), ...fileList]);
}

export function getFolderFiles(key: string): Set<string> {
    const normalizedKey = mergePath(key, "");
    return FolderFiles[normalizedKey] || new Set();
}

export function resetFileList(): void {
    Object.keys(FolderFiles).forEach((key) => delete FolderFiles[key]);
}

function normalizeRoot(root: DataNode): void {
    if (!root.children) {
        root.children = [];
    }
}

export function buildDataNode(roots: DataNode[], path: string): void {
    let pathParts = path.split("/").filter((part) => part !== "");
    if (pathParts.length === 0) {
        return;
    }
    if (pathParts.length === 1) {
        roots.push({
            key: mergePath(path),
            title: path,
            children: [],
        });
        return;
    }

    let root = roots.find((node) => path.indexOf(node.key as string) >= 0);
    if (!root) {
        root = {
            key: mergePath(pathParts[0]),
            title: pathParts[0],
            children: [],
        };
        roots.push(root);
    }
    pathParts = path
        .replace(root.key as string, "")
        .split("/")
        .filter((part) => part !== "");
    traverseTree(root, pathParts, path);
}

function traverseTree(root: DataNode, pathParts: string[], path: string): DataNode {
    normalizeRoot(root);

    if (pathParts.length <= 1) {
        // Leaf node, add file to root's list
        updateFileList(root.key as string, new Set([path]));
        return root;
    }

    let child = root.children?.find((node) => path.indexOf(node.key as string) >= 0);
    if (!child) {
        child = {
            key: mergePath(root.key as string, pathParts[0]),
            title: pathParts[0],
            children: [],
        };

        root.children?.push(child);
    }

    traverseTree(child, pathParts.slice(1), path);

    updateFileList(root.key as string, getFolderFiles(child.key as string));

    return child;
}
