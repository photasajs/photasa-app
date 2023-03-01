export function getFilesInFolderTree(
    folderTree: FolderTree,
    files: Set<string> = new Set(),
): Set<string> {
    folderTree.children.forEach((child) => {
        if (child.type === "file") {
            files.add(child.path);
        } else {
            getFilesInFolderTree(child, files);
        }
    });
    return files;
}
