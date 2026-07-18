import type { FolderNode } from "@photasa/common";
import { splitPath, normalizePath, mergePath } from "@renderer/utils/api-path";
import type { Photo } from "@photasa/common";

function normalizeRoot(root: FolderNode): void {
    if (!root.children) {
        root.children = [];
    }
}

/**
 * 添加根节点到文件夹树
 *
 * 设计目的：用户主动添加监控路径时创建根节点
 * - 只有通过此函数添加的路径才能成为根节点
 * - 用于"添加路径"功能，不用于扫描过程
 * - 如果根节点已存在，不重复添加
 *
 * @param roots 文件夹树根节点数组
 * @param rootPath 根节点路径
 */
export function addRoot(roots: FolderNode[], rootPath: string): void {
    // 检查根节点是否已存在
    const exists = roots.some((node) => node.key === rootPath);
    if (exists) {
        return;
    }
    // 添加新根节点
    roots.push({
        key: rootPath,
        title: rootPath,
        children: [],
    });
    // 排序根节点
    roots.sort((item1, item2) => item1.key.toString().localeCompare(item2.key.toString()));
}

/**
 * 从文件夹树移除根节点
 *
 * 设计目的：用户主动移除监控路径时删除根节点
 * - 只用于"移除路径"功能
 * - 删除整个根节点及其所有子节点
 * - 如果根节点不存在，静默跳过
 *
 * @param roots 文件夹树根节点数组
 * @param rootPath 根节点路径
 */
export function removeRoot(roots: FolderNode[], rootPath: string): void {
    const index = roots.findIndex((node) => node.key === rootPath);
    if (index >= 0) {
        roots.splice(index, 1);
    }
}

/**
 * 清理文件夹树中的数据节点
 *
 * 设计目的：清理文件夹树中的数据节点
 * - 用于清理文件夹树中的数据节点
 * - 如果文件路径为空，则放弃清理
 * - 如果文件路径不存在，则放弃清理
 */
export function cleanDataNode(roots: FolderNode[], file: Photo): void {
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

function cleanChild(nodes: FolderNode[], file: Photo): void {
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
 * 向文件夹树添加文件夹节点
 *
 * 设计目的：从文件路径构建文件夹层级结构
 * - 用于扫描过程中，根据图片文件路径自动构建文件夹树
 * - 仅当第一级为已存在根节点时才允许添加子文件夹
 * - 若第一级未匹配到 roots，则放弃添加，防止自动扩展根目录
 * - 只允许用户主动添加的根目录作为树的第一级
 *
 * @param roots 文件夹树根节点数组
 * @param file 文件对象（使用其path属性构建文件夹结构）
 */
export function addFolderToTree(roots: FolderNode[], file: Photo): void {
    // 如果文件路径为空，则放弃添加
    let pathParts = splitPath(file.path).filter((part: string) => part !== "");
    if (pathParts.length === 0) {
        return;
    }
    // 只有父节点（根节点）存在时才允许添加子节点
    // 这里判断是否在当前的路径中可以找到根节点，如果找不到，则放弃添加
    const root = roots.find((node) => file.path.indexOf(node.key as string) >= 0);
    if (!root) {
        // 父节点不存在，放弃添加该子节点，保证数据一致性
        // 设计原则：只有用户主动添加的路径才能成为根节点
        // 扫描到的子文件夹不应自动提升为根节点
        return;
    }
    // 提取子节点路径，去掉父节点路径
    pathParts = splitPath(file.path.replace(root.key as string, "")).filter(
        (part: string) => part !== "",
    );
    // 递归遍历子节点
    traverseTree(root, pathParts, file);
}

/**
 * 遍历目录树，添加子节点
 * @param root 根节点
 * @param pathParts 路径部分
 * @param file 文件/目录节点
 * @returns 子节点
 */
function traverseTree(root: FolderNode, pathParts: string[], file: Photo): FolderNode {
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
