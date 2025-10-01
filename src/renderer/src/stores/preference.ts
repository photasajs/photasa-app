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
            logger.debug(`✍️ 添加扫描文件夹: ${folder}, 动作: ${action}, 来源: ${source}`);

            // 导入优先级排序工具
            const {
                createScanAction,
                sortScanningFolders,
                updateScanActionPriority,
                shouldUpdateScanAction,
                debugPrintScanningFolders,
            } = await import("@renderer/utils/scan-priority");

            if (!Array.isArray(this.scanningFolder)) {
                logger.debug("✍️ 初始化扫描文件夹数组");
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
                    logger.debug(`✍️ 更新现有文件夹: ${folder}`);
                    logger.debug(
                        `✍️ Previous: ${existing.action}(${existing.source}) -> New: ${action}(${source})`,
                    );

                    this.scanningFolder[existingIndex] = updateScanActionPriority(
                        existing,
                        action,
                        source,
                    );
                    this.scanningFolder = sortScanningFolders(this.scanningFolder);
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
                    thumbnailSize: this.thumbnailSize,
                    operationType: "directory", // Default to directory for legacy compatibility
                },
                source,
            );

            // Add the new folder to scan
            logger.debug("✍️ 添加新文件夹到扫描:", folder);
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
                this.scanningFolder,
                `batch_add_completed_${folders.length}_folders`,
            );
        },
        async addFileOperation(operation: FileOperationInput) {
            logger.debug("✍️ Adding file operation to queue:", operation);

            if (!Array.isArray(this.scanningFolder)) {
                logger.debug("✍️ 初始化扫描文件夹数组");
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
                    logger.debug("✍️ 更新现有文件操作:", normalizedPath);
                    this.scanningFolder[existingIndex] = {
                        ...this.scanningFolder[existingIndex],
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
            this.thumbnailSize = size >= 150 && size <= 400 ? size : 150;
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
            this.scanningFolder = this.scanningFolder.filter(
                (folder) => !folder.path.startsWith(path),
            );
            logger.info(`✍️ 从扫描队列中移除 ${originalLength - this.scanningFolder.length}`);

            // Complete scan for the removed path
            this.completeScanPath(path);

            // Reset current folder if it was the removed one
            if (this.currentFolder === path) {
                this.currentFolder = this.paths[0] || "";
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
            this.autoUpdate = {
                enabled: true,
                checkInterval: 24,
                allowPrerelease: false,
                autoInstall: false,
            };
            logger.debug("✍️ 重置自动更新配置为默认值");
        },
    },
});
