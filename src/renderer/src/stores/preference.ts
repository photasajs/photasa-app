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

/**
 * 自动更新配置接口
 * 控制应用的自动更新行为
 */
export interface AutoUpdateConfig {
    /** 是否启用自动更新 */
    enabled: boolean;
    /** 检查更新间隔（小时） */
    checkInterval: number;
    /** 是否允许预发布版本 */
    allowPrerelease: boolean;
    /** 是否自动安装更新 */
    autoInstall: boolean;
    /** 上次检查时间戳（可选） */
    lastCheck?: string;
}

/**
 * 统一偏好设置接口 - 与天界(Wenchang)保持一致
 * ✅ RFC 0038: Store边界统一，添加scanning和system字段
 *
 * 此接口与src/engines/wenchang/types/index.ts中的UserPreferences保持完全一致
 * 形成天界-人界镜像关系，确保数据结构统一
 */
interface UnifiedPreferences {
    /** 用户界面相关偏好设置 */
    ui: {
        /** 主题标识：支持light、dark、solarized-light、solarized-dark等 */
        theme: string;
        /** 语言代码：zh-CN、en-US等 */
        language: string;
        /** 布局模式：网格、列表、瀑布流 */
        layout: "grid" | "list" | "masonry";
        /** 侧边栏宽度(像素) */
        sidebarWidth: number;
        /** 缩放级别：1.0为100% */
        zoomLevel: number;
    };

    /** 显示相关偏好设置 */
    display: {
        /** 缩略图尺寸(像素)：范围150-400 */
        thumbnailSize: number;
        /** 排序方式：按名称、日期、大小、类型 */
        sortOrder: "name" | "date" | "size" | "type";
        /** 分组方式：不分组、按日期、按文件夹、按类型 */
        groupBy: "none" | "date" | "folder" | "type";
        /** 是否显示隐藏文件 */
        showHidden: boolean;
        /** 是否显示元数据信息 */
        showMetadata: boolean;
    };

    /**
     * 扫描相关偏好设置
     * ✅ RFC 0038新增：从appState迁移paths和excludePatterns到此处
     */
    scanning: {
        /** 监控的路径列表：用户添加的顶层文件夹路径 */
        paths: string[];
        /** 排除的路径模式列表：如.git、node_modules等 */
        excludePatterns: string[];
        /** 是否启用自动扫描 */
        autoScan: boolean;
        /** 扫描并发数：控制同时扫描的文件夹数量 */
        concurrency: number;
        /** 是否启用文件监控 */
        watchEnabled: boolean;
    };

    /** 性能相关偏好设置 */
    performance: {
        /** 最大缓存大小(MB) */
        maxCacheSize: number;
        /** 预加载数量：提前加载的缩略图数量 */
        preloadCount: number;
        /** 是否启用GPU加速 */
        enableGpuAcceleration: boolean;
    };

    /**
     * 系统级偏好设置
     * ✅ RFC 0038新增：从appState迁移autoUpdate到此处
     */
    system: {
        /** 自动更新配置 */
        autoUpdate: AutoUpdateConfig;
    };
}

/**
 * 偏好设置Store状态类型
 * ✅ RFC 0038: 明确划分preferences和appState边界
 *
 * preferences: 用户偏好设置，与天界Wenchang保持同步
 * appState: 应用运行时状态，仅存在于人界Store
 */
export type PreferenceState = {
    /**
     * 统一偏好设置 - 与天界一致
     * 此对象结构应与Wenchang的UserPreferences完全一致
     */
    preferences: UnifiedPreferences;

    /**
     * 应用运行时状态 - Store特有
     * ✅ RFC 0038: paths、excludePaths、autoUpdate已迁移到preferences
     */
    appState: {
        /** 是否首次运行 */
        firstTime: boolean;
        /** 最后打开的文件夹路径 */
        lastOpenedFolder: string;
        /** 当前打开的文件夹路径 */
        currentFolder: string;
        /** 已扫描的文件夹路径 */
        scannedFolder: string;
        /** 当前文件夹的Photasa配置 */
        currentFolderConfig: PhotasaConfig;
        /** 文件夹树结构 */
        folderTree: DataNode[];
        /**
         * 扫描队列
         * ⏳ 临时保留，将来通过尉迟恭服务(人界)迁移到千里眼引擎(天界)
         * 参考RFC 0032和RFC 0038
         */
        scanningFolder: ScanAction[];
    };
};

export type PreferenceStore = ReturnType<typeof usePreferenceStore>;

export const usePreferenceStore = defineStore("preference", {
    state: (): PreferenceState => {
        return {
            /**
             * 统一偏好设置 - 与天界一致
             * ✅ RFC 0038: 添加scanning和system字段，与Wenchang保持同步
             */
            preferences: {
                /** UI默认设置 */
                ui: {
                    theme: "solarized-dark", // 默认使用solarized-dark主题，与Wenchang一致
                    language: "zh-CN", // 默认简体中文
                    layout: "grid", // 默认网格布局
                    sidebarWidth: 240, // 默认侧边栏宽度240px
                    zoomLevel: 1.0, // 默认缩放级别100%
                },

                /** 显示默认设置 */
                display: {
                    thumbnailSize: 150, // 默认缩略图尺寸150px，与Wenchang一致
                    sortOrder: "name", // 默认按名称排序，与Wenchang一致
                    groupBy: "none", // 默认不分组，与Wenchang一致
                    showHidden: false, // 默认不显示隐藏文件
                    showMetadata: true, // 默认显示元数据
                },

                /**
                 * 扫描默认设置
                 * ✅ RFC 0038: 从appState迁移到preferences.scanning
                 */
                scanning: {
                    paths: [], // 初始监控路径为空，由用户添加
                    excludePatterns: [
                        ".photasaoriginal", // Photasa原始文件跟踪文件夹
                        ".photasaoriginals", // Photasa缩略图缓存文件夹
                        ".photasa.json", // Photasa配置文件
                        ".DS_Store", // macOS系统文件
                        "Thumbs.db", // Windows缩略图文件
                        ".git", // Git版本控制文件夹
                        ".svn", // SVN版本控制文件夹
                        "node_modules", // Node.js依赖文件夹
                    ],
                    autoScan: true, // 默认启用自动扫描
                    concurrency: 4, // 默认并发数为4
                    watchEnabled: true, // 默认启用文件监控
                },

                /** 性能默认设置 */
                performance: {
                    maxCacheSize: 1024, // 默认最大缓存1024MB
                    preloadCount: 20, // 默认预加载20个缩略图
                    enableGpuAcceleration: true, // 默认启用GPU加速
                },

                /**
                 * 系统默认设置
                 * ✅ RFC 0038: 从appState迁移到preferences.system
                 */
                system: {
                    autoUpdate: {
                        enabled: true, // 默认启用自动更新
                        checkInterval: 24, // 每天检查一次
                        allowPrerelease: false, // 默认不允许预发布版本
                        autoInstall: false, // 默认不自动安装，让用户确认
                    },
                },
            },

            /**
             * 应用运行时状态 - Store特有
             * ✅ RFC 0038: 移除paths、excludePaths、autoUpdate，已迁移到preferences
             */
            appState: {
                firstTime: true, // 首次运行标识
                lastOpenedFolder: "", // 最后打开的文件夹
                currentFolder: "", // 当前打开的文件夹
                scannedFolder: "", // 已扫描的文件夹
                currentFolderConfig: <PhotasaConfig>{}, // 当前文件夹配置
                folderTree: [], // 文件夹树结构
                /**
                 * 扫描队列
                 * ⏳ 临时保留，将来通过尉迟恭服务(人界)迁移到千里眼引擎(天界)
                 */
                scanningFolder: [],
            },
        };
    },
    persist: true,

    getters: {
        /**
         * 偏好设置getter - 与天界一致的格式
         * 这些getter提供对preferences对象的快捷访问
         */
        /** 主题标识 */
        themeId: (state) => state.preferences.ui.theme,
        /** 语言代码 */
        locale: (state) => state.preferences.ui.language,
        /** 缩略图尺寸 */
        thumbnailSize: (state) => state.preferences.display.thumbnailSize,
        /** 是否深色模式 */
        darkMode: (state) => state.preferences.ui.theme === "dark",

        /**
         * 偏好设置getter - 扫描相关
         * ✅ RFC 0038: 从preferences.scanning访问，而非appState
         */
        /** 监控路径列表 */
        paths: (state) => state.preferences.scanning.paths,
        /** 排除路径模式列表 */
        excludePaths: (state) => state.preferences.scanning.excludePatterns,

        /**
         * 偏好设置getter - 系统相关
         * ✅ RFC 0038: 从preferences.system访问，而非appState
         */
        /** 自动更新配置 */
        autoUpdate: (state) => state.preferences.system.autoUpdate,

        /**
         * 应用状态getter - 运行时状态
         * 这些getter提供对appState对象的访问
         */
        /** 是否首次运行 */
        firstTime: (state) => state.appState.firstTime,
        /** 最后打开的文件夹 */
        lastOpenedFolder: (state) => state.appState.lastOpenedFolder,
        /** 当前打开的文件夹 */
        currentFolder: (state) => state.appState.currentFolder,
        /** 已扫描的文件夹 */
        scannedFolder: (state) => state.appState.scannedFolder,
        /** 当前文件夹配置 */
        currentFolderConfig: (state) => state.appState.currentFolderConfig,
        /** 文件夹树结构 */
        folderTree: (state) => state.appState.folderTree,
        /** 扫描队列 */
        scanningFolder: (state) => state.appState.scanningFolder,

        /** 兼容性getter - 保持API一致 */
        $state: (state) => state,
    },

    actions: {
        /**
         * 添加监控路径
         * ✅ RFC 0038: 更新为访问preferences.scanning.paths而非appState.paths
         *
         * @param path 要添加的路径
         */
        addPath(path: string) {
            if (this.appState.firstTime) {
                this.appState.firstTime = false;
                this.preferences.scanning.paths = [];
                this.appState.folderTree = [];
                this.preferences.scanning.paths.push(path);
                this.appState.folderTree.push({
                    title: path,
                    key: path,
                    children: [],
                });
                return;
            }

            path = normalizePath(path);

            if (!this.preferences.scanning.paths.find((p) => path.indexOf(p) >= 0)) {
                this.preferences.scanning.paths.push(path);
                this.appState.folderTree.push({
                    title: path,
                    key: path,
                    children: [],
                });
                this.preferences.scanning.paths = this.preferences.scanning.paths.sort();
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
                // ✅ RFC 0038: 从preferences.scanning.paths读取
                this.appState.currentFolder = this.preferences.scanning.paths[0] || "";
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
         * ✅ RFC 0038: 更新为访问preferences.scanning.excludePatterns
         *
         * @param excludePaths 新的排除路径数组
         */
        updateExcludePaths(excludePaths: string[]) {
            this.preferences.scanning.excludePatterns = excludePaths;
        },

        /**
         * 添加单个排除路径
         * ✅ RFC 0038: 更新为访问preferences.scanning.excludePatterns
         *
         * @param path 要添加的路径模式
         */
        addExcludePath(path: string) {
            if (!this.excludePaths.includes(path)) {
                this.preferences.scanning.excludePatterns.push(path);
            }
        },

        /**
         * 移除单个排除路径
         * ✅ RFC 0038: 更新为访问preferences.scanning.excludePatterns
         *
         * @param path 要移除的路径模式
         */
        removeExcludePath(path: string) {
            const index = this.excludePaths.indexOf(path);
            if (index >= 0) {
                this.preferences.scanning.excludePatterns.splice(index, 1);
            }
        },

        /**
         * 重置为默认排除路径
         * ✅ RFC 0038: 更新为访问preferences.scanning.excludePatterns
         */
        resetExcludePaths() {
            this.preferences.scanning.excludePatterns = [
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
         * ✅ RFC 0038: 更新为访问preferences.scanning.paths
         *
         * @param newDirs 需要重建的目录数组
         * 1. 清空 paths、folderTree、scanningFolder
         * 2. 逐一 addPath 并调用 resetPhotasaConfig 重建缓存
         */
        async resetAllFolders(newDirs: string[]) {
            // 停止所有扫描任务
            if (scanPhotosTask.isRunning) {
                scanPhotosTask.cancelAll();
            }
            this.preferences.scanning.paths = [];
            this.appState.folderTree = [];
            this.appState.scanningFolder = [];
            for (const dir of newDirs) {
                this.addPath(dir);
                await window.api?.resetPhotasaConfig?.(dir);
            }
        },
        /**
         * 更新自动更新配置
         * ✅ RFC 0038: 更新为访问preferences.system.autoUpdate
         *
         * @param config 要更新的配置对象（部分更新）
         */
        updateAutoUpdateConfig(config: Partial<AutoUpdateConfig>) {
            this.preferences.system.autoUpdate = {
                ...this.preferences.system.autoUpdate,
                ...config,
            };
            logger.debug("✍️ 更新自动更新配置:", this.autoUpdate);
        },

        /**
         * 设置最后检查时间
         * ✅ RFC 0038: 更新为访问preferences.system.autoUpdate
         *
         * @param timestamp 检查时间戳或ISO字符串
         */
        setAutoUpdateLastCheck(timestamp: string | number) {
            const dateStr =
                typeof timestamp === "string" ? timestamp : new Date(timestamp).toISOString();
            this.preferences.system.autoUpdate.lastCheck = dateStr;
            logger.debug("✍️ 更新自动更新最后检查时间:", dateStr);
        },

        /**
         * 重置自动更新配置为默认值
         * ✅ RFC 0038: 更新为访问preferences.system.autoUpdate
         */
        resetAutoUpdateConfig() {
            this.preferences.system.autoUpdate = {
                enabled: true,
                checkInterval: 24,
                allowPrerelease: false,
                autoInstall: false,
            };
            logger.debug("✍️ 重置自动更新配置为默认值");
        },
    },
});
