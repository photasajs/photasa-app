import { defineStore } from "pinia";
import { normalizePath } from "@renderer/utils/path";
import { scanPhotosTask } from "@renderer/utils/scan-folder";
import { cleanupScanQueue } from "@renderer/utils/api";
import type { PhotasaConfig } from "@common/config-types";
import type { ScanAction, FileOperationInput } from "@common/scan-types";
import type { ThumbnailRequest } from "@common/thumbnail-types";
// 自定义 DataNode 类型定义
export interface DataNode {
    key: string | number;
    title: string;
    children?: DataNode[];
    isLeaf?: boolean;
    disabled?: boolean;
    selectable?: boolean;
    checkable?: boolean;
    [key: string]: any;
}
import { buildDataNode, cleanDataNode } from "@renderer/utils/folder-tree";
import { isVideoFile, toFileName, shortenThumbnailName } from "@renderer/utils/api";
import { loggers } from "@common/logger";

const logger = loggers.app;

export type PreferenceState = {
    paths: string[]; // Paths to monitor
    thumbnailSize: number; // Thumbnail Default Size
    firstTime: boolean; // Is first time running
    darkMode: boolean;
    lastOpenedFolder: string;
    locale: string;
    scanningFolder: ScanAction[];
    currentFolder: string;
    scannedFolder: string;
    currentFolderConfig: PhotasaConfig;
    folderTree: DataNode[];
    themeId: string; // 当前主题 id
    // 导入时排除的路径模式（如 .photasaoriginal, .git 等）
    excludePaths: string[];
};

export type PreferenceStore = ReturnType<typeof usePreferenceStore>;

export const usePreferenceStore = defineStore("preference", {
    state: (): PreferenceState => {
        return {
            paths: [],
            thumbnailSize: 150,
            firstTime: true,
            darkMode: false,
            lastOpenedFolder: "",
            locale: "zh-CN",
            scanningFolder: [],
            currentFolder: "",
            scannedFolder: "",
            currentFolderConfig: <PhotasaConfig>{},
            folderTree: [],
            themeId: "solarized-dark", // 默认空，首次加载时由 theme-manager 设定
            // 默认排除的路径模式
            excludePaths: [
                ".photasaoriginal", // Photasa原始文件跟踪文件夹
                ".photasaoriginals", // Photasa缩略图缓存文件夹
                ".photasa.json", // Photasa配置文件
                ".DS_Store", // macOS系统文件
                "Thumbs.db", // Windows缩略图文件
                ".git", // Git版本控制文件夹
                ".svn", // SVN版本控制文件夹
                "node_modules", // Node.js依赖文件夹
            ],
        };
    },
    persist: true,
    actions: {
        addPath(path: string) {
            if (this.firstTime) {
                this.firstTime = false;
                this.paths = [];
                this.folderTree = [];
                this.paths.push(path);
                this.folderTree.push({
                    title: path,
                    key: path,
                    children: [],
                });
                return;
            }

            path = normalizePath(path);

            if (!this.paths.find((p) => path.indexOf(p) >= 0)) {
                this.paths.push(path);
                this.folderTree.push({
                    title: path,
                    key: path,
                    children: [],
                });
                this.paths = this.paths.sort();
            }
        },
        async addScanFolder(folder: string, action: "scan" | "rescan" | "current") {
            logger.debug(`Adding scan folder: ${folder}, action: ${action}`);
            if (!Array.isArray(this.scanningFolder)) {
                logger.debug("Initializing scanningFolder array");
                this.scanningFolder = [];
            }

            // Normalize the folder path
            folder = normalizePath(folder);

            // Check if the folder is already in the scanning queue
            const existingIndex = this.scanningFolder.findIndex((p) => p.path === folder);
            if (existingIndex >= 0) {
                // 只有在明确要求 rescan 且当前不是 rescan 时才更新
                if (action === "rescan" && this.scanningFolder[existingIndex].action !== "rescan") {
                    logger.debug("Updating existing folder to rescan:", folder);
                    this.scanningFolder[existingIndex].action = "rescan";
                } else {
                    logger.debug(
                        "Folder already in scanning queue with action:",
                        this.scanningFolder[existingIndex].action,
                    );
                }
                return;
            }

            // 智能检查：如果文件夹已扫描且不是强制重新扫描，则跳过
            if (action === "scan") {
                try {
                    const { checkPhotasaConfig } = await import("@renderer/utils/api");
                    const configCheck = await checkPhotasaConfig(folder);

                    if (configCheck.hasConfig) {
                        logger.info(
                            `Folder already scanned, skipping: ${folder} (${configCheck.photoCount} photos)`,
                        );
                        // 仍然更新文件夹树，但不添加到扫描队列
                        this.updateFolderTree(folder);
                        return;
                    }
                } catch (error) {
                    logger.warn(`Failed to check photasa config for ${folder}:`, error);
                    // 如果检查失败，继续正常流程
                }
            }

            // Add the new folder to scan
            logger.debug("Adding new folder to scan:", folder);
            this.scanningFolder.push({
                path: folder,
                action,
                thumbnailSize: this.thumbnailSize,
                operationType: "directory", // Default to directory for legacy compatibility
                createdAt: Date.now(), // Add timestamp for proper sorting
            });
            this.updateFolderTree(folder);
        },
        addFileOperation(operation: FileOperationInput) {
            logger.debug("Adding file operation to queue:", operation);

            if (!Array.isArray(this.scanningFolder)) {
                logger.debug("Initializing scanningFolder array");
                this.scanningFolder = [];
            }

            // Normalize the path
            const normalizedPath = normalizePath(operation.path);

            // For file operations, we don't deduplicate as each file operation should be processed
            // However, we can update existing pending operations of the same type on the same file
            if (operation.operationType === "file") {
                const existingIndex = this.scanningFolder.findIndex(
                    (item) =>
                        item.path === normalizedPath &&
                        item.operationType === "file" &&
                        item.fileOperationId === operation.fileOperationId,
                );

                if (existingIndex >= 0) {
                    // Update existing file operation
                    logger.debug("Updating existing file operation:", normalizedPath);
                    this.scanningFolder[existingIndex] = {
                        ...this.scanningFolder[existingIndex],
                        ...operation,
                        path: normalizedPath,
                    };
                    return;
                }
            }

            // Add new operation to queue
            logger.debug("Adding new file operation to queue:", normalizedPath);
            this.scanningFolder.push({
                path: normalizedPath,
                action: operation.action,
                thumbnailSize: operation.thumbnailSize,
                operationType: operation.operationType,
                priority: operation.priority,
                retryCount: operation.retryCount || 0,
                createdAt: operation.createdAt || Date.now(),
                fileOperationId: operation.fileOperationId,
            });

            // Update folder tree only for directory operations
            if (operation.operationType === "directory") {
                this.updateFolderTree(normalizedPath);
            }
        },
        updateThumbnailSize(size: number) {
            this.thumbnailSize = size >= 150 && size <= 400 ? size : 150;
        },
        completeScanPath(folder: string): void {
            logger.debug(`[completeScanPath] Attempting to complete scan for folder: ${folder}`);
            logger.debug(
                `[completeScanPath] Current scanningFolder before:`,
                this.scanningFolder.map((f) => f.path),
            );

            const index = this.scanningFolder.findIndex((f) => f.path === folder);
            if (index > -1) {
                this.scanningFolder.splice(index, 1);
                logger.debug(
                    `[completeScanPath] Successfully removed folder from scanning queue at index ${index}: ${folder}`,
                );
            } else {
                logger.debug(`[completeScanPath] Folder not found in scanning queue: ${folder}`);
            }

            logger.debug(
                `[completeScanPath] Current scanningFolder after:`,
                this.scanningFolder.map((f) => f.path),
            );
        },
        updateFolderTree(folder: string) {
            const path = normalizePath(folder);
            buildDataNode(this.folderTree, {
                path,
                thumbnail: "",
                isVideo: false,
            });
        },
        cleanFolderTree(folder: string) {
            const path = normalizePath(folder);
            cleanDataNode(this.folderTree, {
                path,
                thumbnail: "",
                isVideo: false,
            });
        },
        removePath(path: string): void {
            logger.debug("Removing path:", path);

            // Remove from paths array
            const index = this.paths.indexOf(path);
            if (index >= 0) {
                this.paths.splice(index, 1);
                logger.debug("Removed from paths array");
            }

            // Remove from folder tree
            const found = this.folderTree.findIndex((node) => node.key === path);
            if (found >= 0) {
                this.folderTree.splice(found, 1);
                logger.debug("Removed from folder tree");
            }

            // Cancel any running scan tasks
            if (scanPhotosTask.isRunning) {
                logger.debug("Cancelling running scan tasks");
                scanPhotosTask.cancelAll();
            }

            // Clean up the scan queue
            logger.debug("Cleaning up scan queue");
            cleanupScanQueue(path);

            // Remove from scanning queue and all its subdirectories
            const originalLength = this.scanningFolder.length;
            this.scanningFolder = this.scanningFolder.filter(
                (folder) => !folder.path.startsWith(path),
            );
            logger.debug(
                `Removed ${
                    originalLength - this.scanningFolder.length
                } folders from scanning queue`,
            );

            // Complete scan for the removed path
            this.completeScanPath(path);

            // Reset current folder if it was the removed one
            if (this.currentFolder === path) {
                this.currentFolder = this.paths[0] || "";
                logger.debug("Reset current folder to:", this.currentFolder);
            }
        },
        addToCurrentPhotasaConfig(request: ThumbnailRequest): void {
            const relativePath = toFileName(request.path);
            if (this.currentFolderConfig.photoList.find((photo) => photo.path === relativePath)) {
                return;
            }
            this.currentFolderConfig.photoList.push({
                path: relativePath,
                thumbnail: shortenThumbnailName(request.thumbnail),
                isVideo: isVideoFile(request.path),
                history: [],
            });
        },
        removeFromCurrentPhotasaConfig(request: ThumbnailRequest): void {
            const relativePath = toFileName(request.path);
            const index = this.currentFolderConfig.photoList.findIndex(
                (photo) => photo.path === relativePath,
            );

            if (index >= 0) {
                this.currentFolderConfig.photoList.splice(index, 1);
            }
        },
        setLocale(locale: string) {
            this.locale = locale;
        },
        setThemeId(themeId: string) {
            this.themeId = themeId;
        },
        /**
         * 更新排除路径列表
         * @param excludePaths 新的排除路径数组
         */
        updateExcludePaths(excludePaths: string[]) {
            this.excludePaths = excludePaths;
        },
        /**
         * 添加单个排除路径
         * @param path 要添加的路径模式
         */
        addExcludePath(path: string) {
            if (!this.excludePaths.includes(path)) {
                this.excludePaths.push(path);
            }
        },
        /**
         * 移除单个排除路径
         * @param path 要移除的路径模式
         */
        removeExcludePath(path: string) {
            const index = this.excludePaths.indexOf(path);
            if (index >= 0) {
                this.excludePaths.splice(index, 1);
            }
        },
        /**
         * 重置为默认排除路径
         */
        resetExcludePaths() {
            this.excludePaths = [
                ".photasaoriginal",
                ".photasaoriginals",
                ".photasa.json",
                ".DS_Store",
                "Thumbs.db",
                ".git",
                ".svn",
                "node_modules",
            ];
        },
        /**
         * 重置所有目录存储
         * @param newDirs 需要重建的目录数组
         * 1. 清空 paths、folderTree、scanningFolder
         * 2. 逐一 addPath 并调用 resetPhotasaConfig 重建缓存
         */
        async resetAllFolders(newDirs: string[]) {
            // 停止所有扫描任务
            if (scanPhotosTask.isRunning) {
                scanPhotosTask.cancelAll();
            }
            this.paths = [];
            this.folderTree = [];
            this.scanningFolder = [];
            for (const dir of newDirs) {
                this.addPath(dir);
                await window.api?.resetPhotasaConfig?.(dir);
            }
        },
    },
});
