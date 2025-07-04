import type { DataNode } from "ant-design-vue/es/tree";
import { mergePath, normalizePath } from "./path";

export type Photo = {
    path: string;
    thumbnail: string;
    isVideo: boolean;
};

function normalizeRoot(root: DataNode): void {
    if (!root.children) {
        root.children = [];
    }
}

export function cleanDataNode(roots: DataNode[], file: Photo): void {
    const pathParts = file.path.split("/").filter((part) => part !== "");
    if (pathParts.length <= 1) {
        return;
    }

    const root = roots.find((node) => file.path.indexOf(node.key as string) >= 0);
    if (!root?.children) {
        return;
    }
    cleanChild(root.children, file);
}

function cleanChild(nodes: DataNode[], file: Photo): void {
    const index = nodes.findIndex((child) => normalizePath(child.key as string) === file.path);

    if (index >= 0) {
        nodes.splice(index, 1);
        return;
    }

    // Find closed node to clean
    const root = nodes.find((node) => file.path.indexOf(node.key as string) >= 0);
    if (root?.children) {
        cleanChild(root.children, file);
    }
}
/**
 * 向目录树添加节点，仅当第一级为已存在根节点时才允许添加。
 * - 若第一级未匹配到 roots，则放弃添加，防止自动扩展根目录。
 * - 只允许用户主动添加的根目录作为树的第一级。
 * @param roots 目录树根节点数组
 * @param file 需添加的文件/目录节点
 */
export function buildDataNode(roots: DataNode[], file: Photo): void {
    // 如果文件路径为空，则放弃添加
    let pathParts = file.path.split("/").filter((part) => part !== "");
    if (pathParts.length === 0) {
        return;
    }
    // 一级目录直接添加到 roots
    if (pathParts.length === 1) {
        roots.push({
            key: mergePath(file.path),
            title: file.path,
            children: [],
        });
        return;
    }
    // 只有父节点（根节点）存在时才允许添加子节点
    // 这里判断 是否在当前的路径中可以找到根节点，如果找不到，则放弃添加
    const root = roots.find((node) => file.path.indexOf(node.key as string) >= 0);
    if (!root) {
        // 父节点不存在，放弃添加该子节点，保证数据一致性
        // 注释：父节点必须先于子节点存在，防止悬空目录
        return;
    }
    pathParts = file.path
        .replace(root.key as string, "")
        .split("/")
        .filter((part) => part !== "");
    traverseTree(root, pathParts, file);
}

function traverseTree(root: DataNode, pathParts: string[], file: Photo): DataNode {
    normalizeRoot(root);

    if (pathParts.length == 0) {
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
        root.children = root.children?.sort((item1, item2) =>
            item1.key.toString().localeCompare(item2.key.toString()),
        );
    }

    traverseTree(child, pathParts.slice(1), file);
    return child;
}
