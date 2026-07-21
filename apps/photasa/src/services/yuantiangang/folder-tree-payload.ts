/** 从奏折 context 提取 folderTree 数组（纯函数，无 IPC） */
export function extractFolderTreeFromContext(context: Record<string, unknown>): unknown[] {
    const tree = context.tree;
    if (!Array.isArray(tree)) {
        throw new Error("update_folder_tree 缺少 tree 数组");
    }
    return tree;
}
