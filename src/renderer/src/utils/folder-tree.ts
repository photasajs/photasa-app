import type { DataNode } from "@renderer/stores/preference";
import { splitPath, normalizePath, mergePath } from "@renderer/utils/api-path";
import type { Photo } from "@common/config-types";

function normalizeRoot(root: DataNode): void {
    if (!root.children) {
        root.children = [];
    }
}

export function cleanDataNode(roots: DataNode[], file: Photo): void {
    const pathParts = splitPath(file.path).filter((part) => part !== "");
    if (pathParts.length <= 1) {
        return;
    }
    // 如果文件路径为空，则放弃添加
    const root = roots.find((node) => file.path.indexOf(node.key as string) >= 0);
    if (!root?.children) {
        return;
    }
    // 递归删除子节点
    cleanChild(root.children, file);
}

function cleanChild(nodes: DataNode[], file: Photo): void {
    const index = nodes.findIndex((child) => normalizePath(child.key as string) === file.path);
    // 如果子节点存在，则删除子节点
    if (index >= 0) {
        nodes.splice(index, 1);
        return;
    }
    // 递归删除子节点
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
    let pathParts = splitPath(file.path).filter((part) => part !== "");
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
    // 提取子节点路径，去掉父节点路径
    pathParts = splitPath(file.path.replace(root.key as string, "")).filter((part) => part !== "");
    // 递归遍历子节点
    traverseTree(root, pathParts, file);
}

function traverseTree(root: DataNode, pathParts: string[], file: Photo): DataNode {
    normalizeRoot(root);
    // 如果路径为空，则返回根节点
    if (pathParts.length == 0) {
        return root;
    }
    // 如果路径不为空，则查找子节点
    let child = root.children?.find((node) => file.path.indexOf(node.key as string) >= 0);
    // 如果子节点不存在，则创建子节点
    if (!child) {
        child = {
            key: mergePath(root.key as string, pathParts[0]),
            title: pathParts[0],
            children: [],
        };
        // 将子节点添加到根节点
        root.children?.push(child);
        // 排序子节点
        root.children = root.children?.sort((item1, item2) =>
            item1.key.toString().localeCompare(item2.key.toString()),
        );
    }
    // 递归遍历子节点
    traverseTree(child, pathParts.slice(1), file);
    return child;
}
