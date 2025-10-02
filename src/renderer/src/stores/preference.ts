import { defineStore } from "pinia";
import { normalizePath } from "@renderer/utils/path";
import { scanPhotosTask } from "@renderer/utils/scan-folder";
import { cleanupScanQueue } from "@renderer/utils/api";
import type { PhotasaConfig } from "@common/config-types";
import type { ScanAction, FileOperationInput } from "@common/scan-types";
import type { ThumbnailRequest } from "@common/thumbnail-types";
import { buildDataNode, cleanDataNode } from "@renderer/utils/folder-tree";
import { isVideoFile, toFileName, shortenThumbnailName } from "@renderer/utils/api";
import { toDirName } from "@renderer/utils/api-path";
// 导入优先级排序工具
import {
    createScanAction,
    sortScanningFolders,
    updateScanActionPriority,
    shouldUpdateScanAction,
    debugPrintScanningFolders,
} from "@renderer/utils/scan-priority";

import { loggers } from "@common/logger";
// 获取logger实例
const logger = loggers.fangxuanling;

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

// 自动更新配置接口
export interface AutoUpdateConfig {
    enabled: boolean; // 是否启用自动更新
    checkInterval: number; // 检查间隔（小时）
    allowPrerelease: boolean; // 是否允许预发布版本
    autoInstall: boolean; // 是否自动安装更新
    lastCheck?: string; // 上次检查时间
}

/**
 * 统一偏好设置接口 - 与天界保持一致
 */
interface UnifiedPreferences {
    ui: {
        theme: string; // 主题ID: "light", "dark", "solarized-light", "solarized-dark" 等
        language: string; // zh-CN, en-US
        layout: "grid" | "list" | "masonry";
        sidebarWidth: number;
        zoomLevel: number;
    };
    display: {
        thumbnailSize: number; // 150-400
        sortOrder: "name" | "date" | "size" | "type";
        groupBy: "none" | "date" | "folder" | "type";
        showHidden: boolean;
        showMetadata: boolean;
    };
    performance: {
        maxCacheSize: number;
        preloadCount: number;
        enableGpuAcceleration: boolean;
    };
}

export type PreferenceState = {
    // 统一偏好设置 - 与天界一致
    preferences: UnifiedPreferences;

    // 应用状态 - Store特有
    appState: {
        firstTime: boolean;
        lastOpenedFolder: string;
        currentFolder: string;
        scannedFolder: string;
        currentFolderConfig: PhotasaConfig;
        folderTree: DataNode[];
        // 扫描相关保留，等司命处理
        scanningFolder: ScanAction[];
        paths: string[]; // Paths to monitor
        excludePaths: string[]; // 导入时排除的路径模式
        autoUpdate: AutoUpdateConfig; // 自动更新配置
    };
};

export type PreferenceStore = ReturnType<typeof usePreferenceStore>;

export const usePreferenceStore = defineStore("preference", {
    state: (): PreferenceState => {
        return {
            // 统一偏好设置 - 与天界一致
            preferences: {
                ui: {
                    theme: "solarized-dark", // 默认使用solarized-dark主题
                    language: "zh-CN",
                    layout: "grid",
                    sidebarWidth: 240,
                    zoomLevel: 1.0,
                },
                display: {
                    thumbnailSize: 150,
                    sortOrder: "name",
                    groupBy: "none",
                    showHidden: false,
                    showMetadata: true,
                },
                performance: {
                    maxCacheSize: 1024, // MB
                    preloadCount: 20,
                    enableGpuAcceleration: true,
                },
            },

            // 应用状态 - Store特有
            appState: {
                firstTime: true,
                lastOpenedFolder: "",
                currentFolder: "",
                scannedFolder: "",
                currentFolderConfig: <PhotasaConfig>{},
                folderTree: [],
                // 扫描相关保留，等司命处理
                scanningFolder: [],
                paths: [], // Paths to monitor
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
            },
        };
    },
    persist: true,

    getters: {
        // 统一偏好访问 - 与天界一致的格式
        themeId: (state) => state.preferences.ui.theme,
        locale: (state) => state.preferences.ui.language,
        thumbnailSize: (state) => state.preferences.display.thumbnailSize,
        darkMode: (state) => state.preferences.ui.theme === "dark",

        // 应用状态访问
        paths: (state) => state.appState.paths,
        firstTime: (state) => state.appState.firstTime,
        lastOpenedFolder: (state) => state.appState.lastOpenedFolder,
        currentFolder: (state) => state.appState.currentFolder,
        scannedFolder: (state) => state.appState.scannedFolder,
        currentFolderConfig: (state) => state.appState.currentFolderConfig,
        folderTree: (state) => state.appState.folderTree,
        scanningFolder: (state) => state.appState.scanningFolder,
        excludePaths: (state) => state.appState.excludePaths,
        autoUpdate: (state) => state.appState.autoUpdate,

        // 兼容性getter - 保持API一致
        $state: (state) => state,
    },

    actions: {
        addPath(path: string) {
            if (this.appState.firstTime) {
                this.appState.firstTime = false;
                this.appState.paths = [];
                this.appState.folderTree = [];
                this.appState.paths.push(path);
                this.appState.folderTree.push({
                    title: path,
                    key: path,
                    children: [],
                });
                return;
            }

            path = normalizePath(path);

            if (!this.appState.paths.find((p) => path.indexOf(p) >= 0)) {
                this.appState.paths.push(path);
                this.appState.folderTree.push({
                    title: path,
                    key: path,
                    children: [],
                });
                this.appState.paths = this.appState.paths.sort();
            }
        },
        async addScanFolder(
            folder: string,
            action: "scan" | "rescan" | "current",
            source: "user" | "auto" = "user",
        ) {
            logger.debug(`✍️ 添加扫描文件夹: ${folder}, 动作: ${action}, 来源: ${source}`);

            if (!Array.isArray(this.appState.scanningFolder)) {
                logger.debug("✍️ 初始化扫描文件夹数组");
                this.appState.scanningFolder = [];
            }

            // Normalize the folder path
            folder = normalizePath(folder);

            // Check if the folder is already in the scanning queue
            const existingIndex = this.appState.scanningFolder.findIndex((p) => p.path === folder);

            if (existingIndex >= 0) {
                const existing = this.appState.scanningFolder[existingIndex];

                // 检查是否应该更新现有项（基于优先级）
                if (shouldUpdateScanAction(existing, action, source)) {
                    logger.debug(`✍️ 更新现有文件夹: ${folder}`);
                    logger.debug(
                        `✍️ Previous: ${existing.action}(${existing.source}) -> New: ${action}(${source})`,
                    );

                    this.appState.scanningFolder[existingIndex] = updateScanActionPriority(
                        existing,
                        action,
                        source,
                    );
                    this.appState.scanningFolder = sortScanningFolders(
                        this.appState.scanningFolder,
                    );
                } else {
                    logger.debug(
                        `✍️ 文件夹已经在扫描队列中:`,
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
                        // 文件夹已扫描过，跳过扫描
                        this.updateFolderTree(folder);
                        logger.debug(`✍️ 文件夹已经扫描过 (自动来源), 跳过: ${folder}`);
                        return; // 跳过添加到队列
                    }
                } catch (error) {
                    logger.warn(`✍️ 检查 photasa 配置失败: ${folder}:`, error);
                    // 如果检查失败，继续正常流程
                }
            } else if (action === "scan" && source === "user") {
                // 对于用户手动添加的文件夹，始终添加到扫描队列以确保子目录被发现
                logger.debug(`✍️ 用户发起的扫描, 添加到队列: ${folder}`);
            }

            // 创建新的扫描动作（带优先级信息）
            const newScanAction = createScanAction(
                {
                    path: folder,
                    action,
                    thumbnailSize: this.preferences.display.thumbnailSize,
                    operationType: "directory", // Default to directory for legacy compatibility
                },
                source,
            );

            // Add the new folder to scan
            logger.debug("✍️ 添加新文件夹到扫描:", folder);
            this.appState.scanningFolder.push(newScanAction);

            // 排序所有扫描文件夹
            this.appState.scanningFolder = sortScanningFolders(this.appState.scanningFolder);

            // 更新文件夹树
            this.updateFolderTree(folder);

            // Debug: show current queue state
            debugPrintScanningFolders(this.appState.scanningFolder, "updated_scanning_queue");
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
                `✍️ 批量添加 ${folders.length} 个文件夹: 动作: ${action}, 来源: ${source}`,
            );

            // 导入优先级排序工具
            const { debugPrintScanningFolders } = await import("@renderer/utils/scan-priority");

            // 批量添加所有文件夹
            for (const folder of folders) {
                await this.addScanFolder(folder, action, source);
            }

            // Final debug log: show complete queue state
            debugPrintScanningFolders(
                this.appState.scanningFolder,
                `batch_add_completed_${folders.length}_folders`,
            );
        },
        async addFileOperation(operation: FileOperationInput) {
            logger.debug("✍️ Adding file operation to queue:", operation);

            if (!Array.isArray(this.appState.scanningFolder)) {
                logger.debug("✍️ 初始化扫描文件夹数组");
                this.appState.scanningFolder = [];
            }

            // Normalize the path
            const normalizedPath = normalizePath(operation.path);

            // For file operations, we don't deduplicate as each file operation should be processed
            // However, we can update existing pending operations of the same type on the same file
            if (operation.operationType === "file") {
                const existingIndex = this.appState.scanningFolder.findIndex(
                    (item) =>
                        item.path === normalizedPath &&
                        item.operationType === "file" &&
                        item.fileOperationId === operation.fileOperationId,
                );

                if (existingIndex >= 0) {
                    // Update existing file operation
                    logger.debug("✍️ 更新现有文件操作:", normalizedPath);
                    this.appState.scanningFolder[existingIndex] = {
                        ...this.appState.scanningFolder[existingIndex],
                        ...operation,
                        path: normalizedPath,
                    };
                    return;
                }
            }

            // Add new operation to queue
            logger.debug("✍️ 添加新文件操作到队列:", normalizedPath);

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

            this.appState.scanningFolder.push(scanAction);

            // 排序扫描队列
            const { sortScanningFolders } = await import("@renderer/utils/scan-priority");
            this.appState.scanningFolder = sortScanningFolders(this.appState.scanningFolder);

            // Update folder tree for both file and directory operations
            if (operation.operationType === "directory") {
                this.updateFolderTree(normalizedPath);
            } else if (operation.operationType === "file") {
                // For file operations, update tree with parent directory
                try {
                    const parentDir = toDirName(normalizedPath);
                    if (parentDir && parentDir !== normalizedPath && parentDir !== "/") {
                        logger.debug(`✍️ 更新文件夹树: ${parentDir} 文件: ${normalizedPath}`);
                        this.updateFolderTree(parentDir);
                    }
                } catch (error) {
                    logger.warn(`✍️ 更新文件夹树失败: ${normalizedPath}:`, error);
                    // Continue execution, don't interrupt file operation
                }
            }
        },
        updateThumbnailSize(size: number) {
            this.preferences.display.thumbnailSize = size >= 150 && size <= 400 ? size : 150;
        },
        completeScanPath(folder: string): void {
            logger.debug(`✍️ 尝试完成扫描: ${folder}`);
            logger.debug(
                `✍️ 当前扫描文件夹 before:`,
                this.scanningFolder.map((f) => f.path),
            );

            const index = this.scanningFolder.findIndex((f) => f.path === folder);
            if (index > -1) {
                this.scanningFolder.splice(index, 1);
                logger.debug(`✍️ 成功从扫描队列中移除文件夹: 索引 ${index}: ${folder}`);
            } else {
                logger.debug(`✍️ 在扫描队列中找不到文件夹: ${folder}`);
            }
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
            logger.debug("✍️ 移除路径:", path);

            // Remove from paths array
            const index = this.paths.indexOf(path);
            if (index >= 0) {
                logger.debug("✍️ 从 paths 数组中移除");
                this.paths.splice(index, 1);
            }

            // Remove from folder tree
            const found = this.folderTree.findIndex((node) => node.key === path);
            if (found >= 0) {
                logger.debug("✍️ 从文件夹树中移除");
                this.folderTree.splice(found, 1);
            }

            // Cancel any running scan tasks
            if (scanPhotosTask.isRunning) {
                logger.info("✍️ 取消正在运行的扫描任务");
                scanPhotosTask.cancelAll();
            }

            // Clean up the scan queue
            logger.info("✍️ 清理扫描队列");
            cleanupScanQueue(path);

            // Remove from scanning queue and all its subdirectories
            const originalLength = this.scanningFolder.length;
            // Ensure the path to be removed is consistently normalized
            const pathToRemove = normalizePath(path);

            this.appState.scanningFolder = this.appState.scanningFolder.filter((item) => {
                // Ensure the path in the scanning queue item is also consistently normalized
                const itemPath = normalizePath(item.path);

                // If the path to remove is the root, remove all items
                if (pathToRemove === "/") {
                    return false; // Remove this item
                }

                // Keep the item if its path is NOT the pathToRemove itself,
                // and NOT a subdirectory of pathToRemove.
                // A subdirectory check needs to ensure it's not just a prefix match
                // to avoid incorrectly removing paths like '/foobar' when '/foo' is removed.
                const isExactMatch = itemPath === pathToRemove;
                const isSubdirectory = itemPath.startsWith(pathToRemove + "/");

                return !(isExactMatch || isSubdirectory);
            });
            logger.info(`✍️ 从扫描队列中移除 ${originalLength - this.scanningFolder.length} 项`);

            // Complete scan for the removed path
            this.completeScanPath(path);

            // Reset current folder if it was the removed one
            if (this.currentFolder === path) {
                this.appState.currentFolder = this.appState.paths[0] || "";
                logger.info("✍️ 重置当前文件夹为:", this.currentFolder);
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
            this.preferences.ui.language = locale;
        },
        setThemeId(themeId: string) {
            this.preferences.ui.theme = themeId;
        },
        /**
         * 更新排除路径列表
         * @param excludePaths 新的排除路径数组
         */
        updateExcludePaths(excludePaths: string[]) {
            this.appState.excludePaths = excludePaths;
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
            this.appState.excludePaths = [
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
            this.appState.paths = [];
            this.appState.folderTree = [];
            this.appState.scanningFolder = [];
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
            this.appState.autoUpdate = { ...this.appState.autoUpdate, ...config };
            logger.debug("✍️ 更新自动更新配置:", this.autoUpdate);
        },
        /**
         * 设置最后检查时间
         * @param timestamp 检查时间戳或ISO字符串
         */
        setAutoUpdateLastCheck(timestamp: string | number) {
            const dateStr =
                typeof timestamp === "string" ? timestamp : new Date(timestamp).toISOString();
            this.autoUpdate.lastCheck = dateStr;
            logger.debug("✍️ 更新自动更新最后检查时间:", dateStr);
        },
        /**
         * 重置自动更新配置为默认值
         */
        resetAutoUpdateConfig() {
            this.appState.autoUpdate = {
                enabled: true,
                checkInterval: 24,
                allowPrerelease: false,
                autoInstall: false,
            };
            logger.debug("✍️ 重置自动更新配置为默认值");
        },
    },
});
