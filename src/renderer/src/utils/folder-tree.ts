import type { DataNode } from "ant-design-vue/es/tree";
import { mergePath } from "./path";

export type Photo = {
    path: string;
    thumbnail: string;
};

const FolderFiles: Record<string, Set<Photo>> = {};

function updateFileList(key, fileList: Set<Photo>): void {
    const normalizedKey = mergePath(key, "");
    FolderFiles[normalizedKey] = new Set([...(FolderFiles[normalizedKey] ?? []), ...fileList]);
}

export function getFolderFiles(key: string): Set<Photo> {
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

export function buildDataNode(roots: DataNode[], file: Photo): void {
    let pathParts = file.path.split("/").filter((part) => part !== "");
    if (pathParts.length === 0) {
        return;
    }
    if (pathParts.length === 1) {
        roots.push({
            key: mergePath(file.path),
            title: file.path,
            children: [],
        });
        return;
    }

    let root = roots.find((node) => file.path.indexOf(node.key as string) >= 0);
    if (!root) {
        root = {
            key: mergePath(pathParts[0]),
            title: pathParts[0],
            children: [],
        };
        roots.push(root);
    }
    pathParts = file.path
        .replace(root.key as string, "")
        .split("/")
        .filter((part) => part !== "");
    traverseTree(root, pathParts, file);
}

function traverseTree(root: DataNode, pathParts: string[], file: Photo): DataNode {
    normalizeRoot(root);

    if (pathParts.length <= 1) {
        // Leaf node, add file to root's list
        updateFileList(root.key as string, new Set([file]));
        return root;
    }

    let child = root.children?.find((node) => file.path.indexOf(node.key as string) >= 0);
    if (!child) {
        child = {
            key: mergePath(root.key as string, pathParts[0]),
            title: pathParts[0],
            children: [],
        };

        root.children?.push(child);
        root.children = root.children?.sort();
    }

    traverseTree(child, pathParts.slice(1), file);

    updateFileList(root.key as string, getFolderFiles(child.key as string));

    return child;
}
