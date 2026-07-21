import type { FolderNode } from "@photasa/common";

/** 判断两棵 folderTree 是否结构等价（用于跳过无意义的持久化） */
export function isSameFolderTree(left: FolderNode[], right: FolderNode[]): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}
