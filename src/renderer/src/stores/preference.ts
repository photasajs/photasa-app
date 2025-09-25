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
import { toDirName } from "@renderer/utils/api-path";
import { loggers } from "@common/logger";

const logger = loggers.preference;

// 自动更新配置接口
export interface AutoUpdateConfig {
    enabled: boolean; // 是否启用自动更新
    checkInterval: number; // 检查间隔（小时）
    allowPrerelease: boolean; // 是否允许预发布版本
    autoInstall: boolean; // 是否自动安装更新
    lastCheck?: string; // 上次检查时间
}

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
    // 自动更新配置
    autoUpdate: AutoUpdateConfig;
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
            // 默认自动更新配置
            autoUpdate: {
                enabled: true,
                checkInterval: 24, // 每天检查一次
                allowPrerelease: false,
                autoInstall: false, // 默认不自动安装，让用户确认
            },
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
        async addScanFolder(
            folder: string,
            action: "scan" | "rescan" | "current",
            source: "user" | "auto" = "user",
        ) {
            logger.debug(
                `[addScanFolder] Adding scan folder: ${folder}, action: ${action}, source: ${source}`,
            );

            // 导入优先级排序工具
            const {
                createScanAction,
                sortScanningFolders,
                updateScanActionPriority,
                shouldUpdateScanAction,
                debugPrintScanningFolders,
            } = await import("@renderer/utils/scan-priority");

            if (!Array.isArray(this.scanningFolder)) {
                logger.debug("[PreferenceStore] Initializing scanningFolder array");
                this.scanningFolder = [];
            }

            // Normalize the folder path
            folder = normalizePath(folder);

            // Check if the folder is already in the scanning queue
            const existingIndex = this.scanningFolder.findIndex((p) => p.path === folder);

            if (existingIndex >= 0) {
                const existing = this.scanningFolder[existingIndex];

                // 检查是否应该更新现有项（基于优先级）
                if (shouldUpdateScanAction(existing, action, source)) {
                    logger.debug(`Updating existing folder with higher priority: ${folder}`);
                    logger.debug(
                        `Previous: ${existing.action}(${existing.source}) -> New: ${action}(${source})`,
                    );

                    this.scanningFolder[existingIndex] = updateScanActionPriority(
                        existing,
                        action,
                        source,
                    );
                    this.scanningFolder = sortScanningFolders(this.scanningFolder);
                } else {
                    logger.debug(
                        `[PreferenceStore] Folder already in scanning queue with equal or higher priority:`,
                        `${existing.action}(${existing.source}) >= ${action}(${source})`,
                    );
                }
                return;
            }

            // 智能检查：如果文件夹已扫描且不是强制重新扫描，则跳过
            // 注意：对于用户手动添加的文件夹，需要确保子目录能被发现并添加到队列
            if (action === "scan" && source === "auto") {
                try {
                    const { checkPhotasaConfig } = await import("@renderer/utils/api");
                    const configCheck = await checkPhotasaConfig(folder);

                    if (configCheck.hasConfig) {
                        // 文件夹已扫描过，但仍需发现子文件夹以支持递归扫描
                        // 更新文件夹树并继续添加到队列（用于子文件夹发现）
                        this.updateFolderTree(folder);
                        logger.debug(
                            `[PreferenceStore] Folder already scanned (auto source), adding for subfolder discovery: ${folder}`,
                        );
                        // 不要return，继续添加到队列用于子文件夹发现
                    }
                } catch (error) {
                    logger.warn(
                        `[PreferenceStore] Failed to check photasa config for ${folder}:`,
                        error,
                    );
                    // 如果检查失败，继续正常流程
                }
            } else if (action === "scan" && source === "user") {
                // 对于用户手动添加的文件夹，始终添加到扫描队列以确保子目录被发现
                logger.debug(
                    `[PreferenceStore] User-initiated scan, adding to queue regardless of existing config: ${folder}`,
                );
            }

            // 创建新的扫描动作（带优先级信息）
            const newScanAction = createScanAction(
                {
                    path: folder,
                    action,
                    thumbnailSize: this.thumbnailSize,
                    operationType: "directory", // Default to directory for legacy compatibility
                },
                source,
            );

            // Add the new folder to scan
            logger.debug("[PreferenceStore] Adding new folder to scan:", folder);
            this.scanningFolder.push(newScanAction);

            // 排序所有扫描文件夹
            this.scanningFolder = sortScanningFolders(this.scanningFolder);

            // 更新文件夹树
            this.updateFolderTree(folder);

            // Debug: show current queue state
            debugPrintScanningFolders(this.scanningFolder, "updated_scanning_queue");
        },

        /**
         * 批量添加扫描文件夹
         * RFC 0018: 支持优先级排序的批量添加
         */
        async addFoldersForScan(
            folders: string[],
            action: "scan" | "rescan" | "current" = "scan",
            source: "user" | "auto" = "user",
        ) {
            logger.debug(
                `[addFoldersForScan] Batch adding ${folders.length} folders with action: ${action}, source: ${source}`,
            );

            // 导入优先级排序工具
            const { debugPrintScanningFolders } = await import("@renderer/utils/scan-priority");

            // 批量添加所有文件夹
            for (const folder of folders) {
                await this.addScanFolder(folder, action, source);
            }

            // Final debug log: show complete queue state
            debugPrintScanningFolders(
                this.scanningFolder,
                `batch_add_completed_${folders.length}_folders`,
            );
        },
        async addFileOperation(operation: FileOperationInput) {
            logger.debug("Adding file operation to queue:", operation);

            if (!Array.isArray(this.scanningFolder)) {
                logger.debug("[PreferenceStore] Initializing scanningFolder array");
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
                    logger.debug(
                        "[PreferenceStore] Updating existing file operation:",
                        normalizedPath,
                    );
                    this.scanningFolder[existingIndex] = {
                        ...this.scanningFolder[existingIndex],
                        ...operation,
                        path: normalizedPath,
                    };
                    return;
                }
            }

            // Add new operation to queue
            logger.debug("[PreferenceStore] Adding new file operation to queue:", normalizedPath);

            // 导入优先级排序工具以确保完整的字段
            const { ensureCompleteScanAction } = await import("@renderer/utils/scan-priority");

            // 创建扫描动作并确保所有字段完整
            const scanAction = ensureCompleteScanAction({
                path: normalizedPath,
                action: operation.action,
                thumbnailSize: operation.thumbnailSize,
                operationType: operation.operationType,
                priority: operation.priority,
                timestamp: operation.timestamp,
                source: operation.source,
                retryCount: operation.retryCount || 0,
                fileOperationId: operation.fileOperationId,
            });

            this.scanningFolder.push(scanAction);

            // 排序扫描队列
            const { sortScanningFolders } = await import("@renderer/utils/scan-priority");
            this.scanningFolder = sortScanningFolders(this.scanningFolder);

            // Update folder tree for both file and directory operations
            if (operation.operationType === "directory") {
                this.updateFolderTree(normalizedPath);
            } else if (operation.operationType === "file") {
                // For file operations, update tree with parent directory
                try {
                    const parentDir = toDirName(normalizedPath);
                    if (parentDir && parentDir !== normalizedPath && parentDir !== "/") {
                        logger.debug(
                            `[PreferenceStore] Updating folder tree with parent directory: ${parentDir} for file: ${normalizedPath}`,
                        );
                        this.updateFolderTree(parentDir);
                    }
                } catch (error) {
                    logger.warn(
                        `[PreferenceStore] Failed to update folder tree for file ${normalizedPath}:`,
                        error,
                    );
                    // Continue execution, don't interrupt file operation
                }
            }
        },
        updateThumbnailSize(size: number) {
            this.thumbnailSize = size >= 150 && size <= 400 ? size : 150;
        },
        completeScanPath(folder: string): void {
            logger.debug(
                `[PreferenceStore] [completeScanPath] Attempting to complete scan for folder: ${folder}`,
            );
            logger.debug(
                `[PreferenceStore] [completeScanPath] Current scanningFolder before:`,
                this.scanningFolder.map((f) => f.path),
            );

            const index = this.scanningFolder.findIndex((f) => f.path === folder);
            if (index > -1) {
                this.scanningFolder.splice(index, 1);
                logger.debug(
                    `[PreferenceStore] [completeScanPath] Successfully removed folder from scanning queue at index ${index}: ${folder}`,
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
            logger.debug("[PreferenceStore] Removing path:", path);

            // Remove from paths array
            const index = this.paths.indexOf(path);
            if (index >= 0) {
                this.paths.splice(index, 1);
                logger.debug("[PreferenceStore] Removed from paths array");
            }

            // Remove from folder tree
            const found = this.folderTree.findIndex((node) => node.key === path);
            if (found >= 0) {
                this.folderTree.splice(found, 1);
                logger.debug("[PreferenceStore] Removed from folder tree");
            }

            // Cancel any running scan tasks
            if (scanPhotosTask.isRunning) {
                logger.debug("[PreferenceStore] Cancelling running scan tasks");
                scanPhotosTask.cancelAll();
            }

            // Clean up the scan queue
            logger.debug("[PreferenceStore] Cleaning up scan queue");
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
                logger.debug("[PreferenceStore] Reset current folder to:", this.currentFolder);
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
        /**
         * 更新自动更新配置
         * @param config 要更新的配置对象（部分更新）
         */
        updateAutoUpdateConfig(config: Partial<AutoUpdateConfig>) {
            this.autoUpdate = { ...this.autoUpdate, ...config };
            logger.debug("[PreferenceStore] Updated auto-update config:", this.autoUpdate);
        },
        /**
         * 设置最后检查时间
         * @param timestamp 检查时间戳或ISO字符串
         */
        setAutoUpdateLastCheck(timestamp: string | number) {
            const dateStr =
                typeof timestamp === "string" ? timestamp : new Date(timestamp).toISOString();
            this.autoUpdate.lastCheck = dateStr;
            logger.debug("[PreferenceStore] Updated auto-update last check time:", dateStr);
        },
        /**
         * 重置自动更新配置为默认值
         */
        resetAutoUpdateConfig() {
            this.autoUpdate = {
                enabled: true,
                checkInterval: 24,
                allowPrerelease: false,
                autoInstall: false,
            };
            logger.debug("[PreferenceStore] Reset auto-update config to defaults");
        },
    },
});
