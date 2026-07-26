import { canonicalFolderPath } from "@renderer/utils/folder-tree-path";

export type ScanOperationType = "directory" | "file";

/**
 * scan_started 写入 folderTree 时应使用目录路径，文件监视须用父目录
 */
export function resolveScanStartedTreePath(
    scanPath: string,
    operationType: ScanOperationType,
    parentDir: string | null,
): string {
    const normalizedScanPath = canonicalFolderPath(scanPath);
    if (operationType === "file") {
        const normalizedParent = parentDir ? canonicalFolderPath(parentDir) : "";
        return normalizedParent || normalizedScanPath;
    }
    return normalizedScanPath;
}

/**
 * 文件扫描完成后，仅当用户正在查看该父目录时刷新 photoList
 */
export function shouldRefreshFolderConfigAfterFileScan(
    currentFolder: string,
    parentDir: string | null,
): boolean {
    const normalizedCurrent = canonicalFolderPath(currentFolder);
    const normalizedParent = parentDir ? canonicalFolderPath(parentDir) : "";
    return Boolean(normalizedCurrent && normalizedParent && normalizedCurrent === normalizedParent);
}
