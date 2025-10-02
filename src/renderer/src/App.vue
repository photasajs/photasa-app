<script setup lang="ts">
import { computed, ref, inject, onUnmounted, watch } from "vue";
import { storeToRefs } from "pinia";
import ImportPhotos from "./components/ImportPhotos.vue";
import SplitView from "./components/SplitView.vue";
import ImageList from "./components/ImageList.vue";
import FolderList from "./components/FolderList.vue";
import { usePhotosStore } from "@renderer/stores/photos";
import { usePreferenceStore } from "@renderer/stores/preference";
import {
    getDirectory,
    stopWatching,
    resetPhotasaConfig,
    scanSubfolders,
} from "@renderer/utils/api";
// deepCopy removed as no longer needed
import { orchestrateScan, type ScanCallbacks } from "./AppHelper";
import { scanPhotosTask } from "@renderer/utils/scan-folder";
import { startFileWatching } from "./utils/file-handler";
import { loggers } from "@common/logger";
import { mapFileOperationToScanAction } from "@common/file-operation-utils";

import UserPreference from "./components/UserPreference.vue";
import ScanQueueDialog from "./components/ScanQueueDialog.vue";
import { useI18n } from "vue-i18n";
import { useTitle, watchArray } from "@vueuse/core";
import { useStatusBarStore } from "@renderer/stores/statusBar";
import { FindPhotoServiceKey } from "@renderer/interfaces/find-photo-service.interface";
import { getThemeManager, ThemeMeta } from "@renderer/components/settings/ThemeSettingsHelper";
import { onMounted } from "vue";
import StatusBar from "./components/common/StatusBar.vue";
import TitlebarMac from "./components/TitlebarMac.vue";
import TitlebarWinLinux from "./components/TitlebarWinLinux.vue";
import { useMenusStore } from "@renderer/stores/menus";
import {
    NotificationContainer,
    PortalProvider,
    BaseModal,
    BaseSpinner,
    UpdateNotification,
} from "@renderer/components/ui";
import QueueHealthDashboard from "./components/queue-monitoring/QueueHealthDashboard.vue";
import { queueMonitoringService } from "@renderer/services/queue-monitoring-service";
import { scanMonitoringService } from "@renderer/services/scan-monitoring-service";
import LogConsole from "./components/LogConsole.vue";
import { useUpdateListener } from "@renderer/composables/useUpdateListener";

/**
 * 日志记录器
 */
const logger = loggers.lishiming;
const themeManager = getThemeManager();
const { t } = useI18n();
const photosStore = usePhotosStore();
const { processingFile } = storeToRefs(photosStore);
const preferenceStore = usePreferenceStore();
const { paths, currentFolder, scanningFolder, thumbnailSize } = storeToRefs(preferenceStore);
const { addPath, completeScanPath, addScanFolder, updateFolderTree } = preferenceStore;

// 初始化更新监听器
const { updateStore } = useUpdateListener();

const showImportDialog = ref(false);
const showPreference = ref(false);
const showScanList = ref(false);
const showQueueDashboard = ref(false);
const loading = ref(false);

const findPhotoService = inject(FindPhotoServiceKey);
if (!findPhotoService) {
    throw new Error("FindPhotoService not provided");
}

const themes = ref<ThemeMeta[]>([]);
const currentThemeId = ref<string>("");
const statusBarStore = useStatusBarStore();
const menusStore = useMenusStore();

const isMac = window.api.isMac();

function handleOpenScanList() {
    showScanList.value = true;
}
function handleOpenQueueDashboard() {
    showQueueDashboard.value = true;
    if (!queueMonitoringService.isMonitoring.value) {
        queueMonitoringService.startMonitoring();
    }
}
function handleOpenImportPhotos() {
    logger.debug("Opening import photos dialog...");
    showImportDialog.value = true;
    logger.debug("showImportDialog.value:", showImportDialog.value);
}
function handleOpenPreference() {
    showPreference.value = true;
}

/**
 * Initialize the application
 */
async function initializeApp(): Promise<void> {
    try {
        const dir = await getDirectory("desktop");

        // Desktop directory is ready
        if (paths.value.length === 0) {
            addPath(dir);
        }

        loading.value = false;

        if (!currentFolder.value && paths.value.length > 0) {
            preferenceStore.appState.currentFolder = paths.value[0];
        }

        if (paths.value.length > 0) {
            startFileWatching(paths.value, preferenceStore);
        } else {
            // Open preference to config
            showPreference.value = true;
        }

        processingFile.value = t("status.loadingConfig");
        // Start to check if any leftover folder need to scan
        startScanning();
    } catch (error) {
        logger.error("👑 李世民登基失败:", error);
        loading.value = false;
        // Open preference to config on error
        showPreference.value = true;
    }
}

onMounted(async () => {
    // APP 启动时推送初始化状态
    statusBarStore.update({
        type: "app",
        status: "initializing",
        task: t("app.title"),
        timestamp: Date.now(),
    });

    // 应用启动时全局初始化菜单栏数据（国际化）
    await themeManager.loadBuiltInThemes();
    themes.value = themeManager.getThemes();

    // 获取Store中的主题设置
    const storeThemeId = preferenceStore.preferences.ui.theme;
    currentThemeId.value = storeThemeId || themes.value[0]?.id || "";

    // 应用主题到DOM
    if (currentThemeId.value) {
        try {
            await themeManager.applyTheme(currentThemeId.value, "/src/renderer/src/themes");
            logger.info("👑 应用主题成功:", currentThemeId.value);
        } catch (error) {
            logger.error("👑 应用主题失败:", error);
        }
    }

    // 主题加载完毕，切换为 ready 状态
    statusBarStore.update({
        type: "app",
        status: "ready",
        task: t("app.title"),
        timestamp: Date.now(),
    });
    // 应用启动时全局初始化菜单栏数据（国际化）
    menusStore.refreshMenus(t);

    // 监听Store中主题变化，自动应用主题
    watch(
        () => preferenceStore.preferences.ui.theme,
        async (newThemeId) => {
            if (newThemeId && newThemeId !== currentThemeId.value) {
                try {
                    await themeManager.applyTheme(newThemeId, "/src/renderer/src/themes");
                    currentThemeId.value = newThemeId;
                    logger.info("👑 主题切换成功:", newThemeId);
                } catch (error) {
                    logger.error("👑 主题切换失败:", error);
                }
            }
        },
        { immediate: false }, // 不立即执行，因为初始化时已经应用过
    );

    // 初始化扫描监控服务
    scanMonitoringService.setScanIdleChecker(() => scanPhotosTask.isIdle);
    scanMonitoringService.startMonitoring(() => {
        logger.info("👑 [扫描监控] 自动恢复触发，重启扫描");
        startScanning();
    });

    // Initialize the application
    await initializeApp();
});

// 组件卸载时清理监控服务
onUnmounted(() => {
    scanMonitoringService.stopMonitoring();
    logger.info("👑 [App] 扫描监控服务已停止");
});

// vue3 watch for array, should specify deep as true
watchArray(
    paths,
    () => {
        // Stop current watching, then start a new one
        stopWatching().then(() => {
            startFileWatching(paths.value, preferenceStore);
        });
    },
    { deep: true },
);

// 包装 addScanFolder 增加日志和source参数
function addScanFolderWithLog(
    folder: string,
    action: "scan" | "rescan" | "current",
    source: "user" | "auto" = "user",
) {
    logger.info(
        `👑 [addScanFolderWithLog] Adding folder to queue: ${folder}, action: ${action}, source: ${source}`,
    );

    // 直接添加到队列，让 preference store 处理优先级和去重
    // preference store 会根据优先级决定是否更新或跳过
    addScanFolder(folder, action, source);

    logger.info(`[addScanFolderWithLog] Folder added to queue: ${folder} with source: ${source}`);
}

watchArray(
    scanningFolder,
    () => {
        if (scanPhotosTask.isIdle) {
            logger.info("👑 scanPhotosTask is idle, calling startScanning");
            startScanning();
        } else {
            logger.info("👑 scanPhotosTask is not idle, will retry in 500ms");
            setTimeout(() => {
                if (scanPhotosTask.isIdle) {
                    logger.debug("👑 scanPhotosTask became idle, retrying startScanning");
                    startScanning();
                } else {
                    logger.warn("👑 scanPhotosTask still not idle after 500ms");
                }
            }, 500);
        }
    },
    { deep: true },
);

// 创建回调对象，连接纯函数与副作用
const callbacks: ScanCallbacks = {
    logInfo: logger.info.bind(logger),
    logDebug: logger.debug.bind(logger),
    logError: logger.error.bind(logger),

    // 国际化
    t: (key: string, params?: Record<string, any>) => t(key, params || {}),

    updateProcessingStatus: (status: string) => {
        processingFile.value = status;
        // 同时更新状态栏
        statusBarStore.update({
            type: "scan",
            status: "scanning",
            task: status,
            timestamp: Date.now(),
        });
    },

    updateFileProgress: (fileName: string, current?: number, total?: number) => {
        // 更新文件级别的处理状态 - 直接显示完整文件路径
        const progressText = current && total ? ` (${current}/${total})` : "";
        processingFile.value = `${fileName}${progressText}`;
        // 同时更新状态栏，传递完整路径到data.currentFile
        statusBarStore.update({
            type: "scan",
            status: "scanning",
            task: `${fileName}${progressText}`,
            data: { currentFile: fileName },
            timestamp: Date.now(),
        });
    },

    clearProcessingStatus: () => {
        processingFile.value = "";
        // 清理状态栏扫描状态
        statusBarStore.update({
            type: "scan",
            status: "ready",
            task: t("app.title"),
            timestamp: Date.now(),
        });
    },

    updateFolderTree: updateFolderTree,
    completeScanPath: completeScanPath,

    scanSubfolders: scanSubfolders,
    addScanFolderToQueue: (path: string, action: string) => {
        // 子目录发现使用 "auto" 源，以区分用户手动添加
        addScanFolderWithLog(path, action as "scan" | "rescan" | "current", "auto");
    },

    performScanTask: async (action) => {
        action.thumbnailSize = thumbnailSize.value;
        return await scanPhotosTask.perform(action);
    },

    resetPhotasaConfig: async (path: string) => {
        await resetPhotasaConfig(path);
    },

    extractParentDir: (path: string) => {
        try {
            return window.api.toDirName(path);
        } catch {
            return null;
        }
    },

    scheduleNextScan: () => {
        setTimeout(() => startScanning(), 0);
    },
};

async function startScanning(): Promise<void> {
    logger.debug("👑 [扫描启动] 开始扫描流程");

    try {
        // 记录扫描活动
        scanMonitoringService.recordActivity();

        // 调用纯函数处理扫描逻辑
        const result = await orchestrateScan(scanningFolder.value, callbacks);

        // 根据结果决定是否继续
        if (result.shouldScheduleNext) {
            callbacks.scheduleNextScan();
        }

        if (result.error) {
            logger.error("👑 Scan orchestration error:", result.error);
            scanMonitoringService.recordFailure();
        } else {
            // 记录成功的扫描活动
            scanMonitoringService.recordActivity();
        }
    } catch (error) {
        logger.error("👑 [扫描启动] 扫描过程中发生异常", error);
        scanMonitoringService.recordFailure();
        throw error;
    }
}

function handlePreferenceOk(): void {
    showPreference.value = false;
}

// 更新处理函数
function handleUpdateInstall(): void {
    updateStore.startDownload();
    // 调用主进程开始下载
    window.api?.downloadUpdate?.();
}

function handleUpdateInstallNow(): void {
    // 调用主进程安装更新
    window.api?.installUpdate?.();
}
// Update title
const title = computed(() => {
    return `${t("app.title")} - ${currentFolder.value}`;
});
useTitle(title);

// 监听 find-photo 事件，用于刷新树结构
// 🔧 状态栏路径显示修复：processScannedFileTask 回调中增强了路径构造逻辑
// 相关修改：将 args.currentFile (文件名) 与 args.action.path (目录路径) 结合，构造完整文件路径
findPhotoService.onFindPhoto((args: any) => {
    logger.debug("👑 onFindPhoto received:", args.type, args.action?.path, args.progress);

    // 记录扫描活动（表示有进展）
    if (args.progress || args.type === "complete") {
        scanMonitoringService.recordActivity();
    }

    // 处理进度更新 - 更新scanningFolder中对应项目的progress信息
    if (args.progress && args.action?.path) {
        const targetIndex = scanningFolder.value.findIndex(
            (item) => item.path === args.action.path,
        );
        if (targetIndex >= 0) {
            logger.debug(
                `👑 Updating progress for ${args.action.path}: ${args.progress.processed}/${args.progress.total}`,
                `Updating progress for ${args.action.path}: ${args.progress.processed}/${args.progress.total}`,
            );
            scanningFolder.value[targetIndex].progress = {
                processed: args.progress.processed || 0,
                total: args.progress.total || 0,
                cacheEnabled: true,
            };
        }

        // 更新当前处理的文件信息到状态栏
        // 关键修复：确保状态栏显示完整文件路径而不是仅文件名
        if (args.currentFile) {
            /**
             * 路径构造逻辑：
             * - args.action.path: 扫描的目录路径（完整路径）
             * - args.currentFile: 当前处理的文件名（仅文件名，来自 scan-worker.ts 的 path.basename()）
             * - 目标：构造完整的文件路径供状态栏显示
             *
             * 示例：
             * - args.action.path = "/Users/john/Photos"
             * - args.currentFile = "bamm.jpg"
             * - fullFilePath = "/Users/john/Photos/bamm.jpg"
             *
             * 安全处理：
             * - replace(/\/+/g, "/") 确保路径中不会出现双斜杠问题
             * - 支持 Unix/Linux/macOS 路径格式
             */
            const fullFilePath = `${args.action.path}/${args.currentFile}`.replace(/\/+/g, "/");
            processingFile.value = `${t("status.scanning")} ${fullFilePath}`;
        } else {
            // 当没有具体文件信息时，显示目录路径
            processingFile.value = `${t("status.scanning")} ${args.action.path}`;
        }
    }

    // 批量刷新树结构
    if (args.type === "complete" && Array.isArray(args.paths)) {
        args.paths.forEach((p: string) => updateFolderTree(p));
        // 清理处理文件状态
        processingFile.value = "";
        // 注意：不要在这里调用completeScanPath和startScanning，因为startScanning函数内部已经处理了这些逻辑
    } else if (args?.action?.path && args?.action?.isDirectory) {
        // 单个刷新树结构
        updateFolderTree(args.action.path as string);
        // 如果是单个完成事件，也清理处理文件状态
        if (args.type === "complete") {
            processingFile.value = "";
        }
        // 注意：不要在这里调用completeScanPath和startScanning，因为startScanning函数内部已经处理了这些逻辑
    }
});

// 监听统一队列事件，处理文件监视产生的批量操作
window.api?.onScanQueueAdd((operations: any[]) => {
    logger.debug(`👑 Received ${operations.length} file operations from watch service`);

    // Process batch of file operations
    operations.forEach((operation) => {
        logger.debug("👑 Adding file operation to queue:", operation);

        // Convert FileOperation to enhanced ScanAction for unified processing
        const fileOperation = {
            path: operation.path,
            action: mapFileOperationToScanAction(operation.type),
            thumbnailSize: operation.metadata?.thumbnailSize || thumbnailSize.value,
            operationType: (operation.metadata?.isFile ? "file" : "directory") as
                | "file"
                | "directory",
            priority: operation.priority,
            timestamp: operation.timestamp,
            source: "auto" as const, // File operations are typically auto-generated
            retryCount: operation.retryCount,
            fileOperationId: operation.id,
        };

        // Add to persistent queue using new enhanced method
        preferenceStore.addFileOperation(fileOperation);
    });
});
</script>

<template>
    <BaseSpinner v-if="loading" />
    <div v-else class="app-layout">
        <!-- 分平台 titlebar -->
        <TitlebarMac
            v-if="isMac"
            @openScanList="handleOpenScanList"
            @openQueueDashboard="handleOpenQueueDashboard"
            @openImportPhotos="handleOpenImportPhotos"
            @openPreference="handleOpenPreference"
        />
        <TitlebarWinLinux
            v-else
            @openScanList="handleOpenScanList"
            @openQueueDashboard="handleOpenQueueDashboard"
            @openImportPhotos="handleOpenImportPhotos"
            @openPreference="handleOpenPreference"
        />
        <!-- 其余内容保持不变 -->
        <div class="content app-container">
            <split-view direction="horizontal" a-init="350px" a-min="200px" a-max="600px">
                <template #A>
                    <div class="image-content">
                        <FolderList></FolderList>
                    </div>
                </template>
                <template #B>
                    <div class="image-content image-list">
                        <ImageList @import="showImportDialog = true" />
                        <ImportPhotos
                            :show="showImportDialog"
                            @update:show="showImportDialog = $event"
                        />
                    </div>
                </template>
            </split-view>
        </div>
        <StatusBar />
    </div>
    <BaseModal
        :open="showPreference"
        :title="t('preference.settings')"
        size="custom"
        :style="{ '--modal-width': '800px' }"
        @close="handlePreferenceOk"
    >
        <UserPreference></UserPreference>
    </BaseModal>

    <ScanQueueDialog
        :show="showScanList"
        :scanning-folder="scanningFolder"
        @close="showScanList = false"
    />
    <BaseModal
        :open="showQueueDashboard"
        title="队列健康监控"
        size="custom"
        :style="{ '--modal-width': '1200px' }"
        @close="
            showQueueDashboard = false;
            queueMonitoringService.stopMonitoring();
        "
    >
        <QueueHealthDashboard />
    </BaseModal>

    <!-- 通知容器 -->
    <NotificationContainer />

    <!-- 更新通知组件 -->
    <UpdateNotification
        v-if="updateStore.hasUpdate"
        :id="`update-${Date.now()}`"
        :update-info="updateStore.updateInfo"
        :download-progress="updateStore.downloadProgress"
        :is-downloading="updateStore.isDownloading"
        :is-ready-to-install="updateStore.isReadyToInstall"
        @close="updateStore.hideUpdateNotification"
        @cancel="updateStore.hideUpdateNotification"
        @install="handleUpdateInstall"
        @cancel-download="updateStore.cancelDownload"
        @install-now="handleUpdateInstallNow"
    />

    <!-- Portal提供者 - 为下拉菜单等组件提供渲染目标 -->
    <PortalProvider />
    <!-- 日志控制台 -->
    <LogConsole />
</template>

<style lang="less">
/* 全局表单标签样式 - 主题适配 */
.ant-form-item-label > label {
    color: var(--color-text) !important;
}

:root {
    /* 主题变量控制 footer 高度 */
    --photasa-footer-height: 70px;
    --photasa-header-height: 36px;
}

.app-layout {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--color-bg); /* 确保整个应用使用主题背景色 */
}

.content {
    flex: 1;
    min-height: 0; /* 重要：允许 flex 子元素收缩 */
    background: var(--color-bg); /* 使用主题背景色 */
}

.image-content {
    height: 100%;
    overflow: hidden; /* 阻止外层滚动，让内部组件控制 */
    display: flex;
    flex-direction: column;
}

.image-list {
    margin: 0;
    height: 100%;
    width: 100%;
    flex: 1;
}

.title-header {
    flex-grow: 1;
    user-select: none;
    -webkit-app-region: drag;
}

.setting-header {
    float: right;
    margin-right: 16px;
}

.app-footer {
    padding: 0;
    height: 32px;
    line-height: 32px;
    padding-left: 20px;
    justify-content: center;
    /* 背景、边框、文字色均由主题变量控制 */
    background: var(--color-footer-bg);
    color: var(--color-footer-text);
    border-top: 1px solid var(--color-footer-border);
}

.system-icon {
    height: 1.5ren;
    width: 1.5rem;
}

/* 全局滚动条样式 - 使用主题变量 */
.scrollbar-theme {
    scrollbar-width: thin;
    scrollbar-color: var(--color-scrollbar-thumb, #cccccc) var(--color-scrollbar-track, #f5f5f5);
}

.scrollbar-theme::-webkit-scrollbar {
    width: var(--color-scrollbar-width, 8px);
    height: var(--color-scrollbar-width, 8px);
}

.scrollbar-theme::-webkit-scrollbar-track {
    background: var(--color-scrollbar-track, #f5f5f5);
    border-radius: var(--color-scrollbar-border-radius, 4px);
}

.scrollbar-theme::-webkit-scrollbar-track:hover {
    background: var(--color-scrollbar-track-hover, #e8e8e8);
}

.scrollbar-theme::-webkit-scrollbar-thumb {
    background: var(--color-scrollbar-thumb, #cccccc);
    border-radius: var(--color-scrollbar-border-radius, 4px);
    transition: all 0.2s ease;
}

.scrollbar-theme::-webkit-scrollbar-thumb:hover {
    background: var(--color-scrollbar-thumb-hover, #0066b8);
}

.scrollbar-theme::-webkit-scrollbar-thumb:active {
    background: var(--color-scrollbar-thumb-active, #004d99);
}

/* 细滚动条变体 */
.scrollbar-theme-thin {
    scrollbar-width: thin;
    scrollbar-color: var(--color-scrollbar-thumb, #cccccc) var(--color-scrollbar-track, #f5f5f5);
}

.scrollbar-theme-thin::-webkit-scrollbar {
    width: var(--color-scrollbar-width-thin, 4px);
    height: var(--color-scrollbar-width-thin, 4px);
}

.scrollbar-theme-thin::-webkit-scrollbar-track {
    background: var(--color-scrollbar-track, #f5f5f5);
    border-radius: var(--color-scrollbar-border-radius, 4px);
}

.scrollbar-theme-thin::-webkit-scrollbar-track:hover {
    background: var(--color-scrollbar-track-hover, #e8e8e8);
}

.scrollbar-theme-thin::-webkit-scrollbar-thumb {
    background: var(--color-scrollbar-thumb, #cccccc);
    border-radius: var(--color-scrollbar-border-radius, 4px);
    transition: all 0.2s ease;
}

.scrollbar-theme-thin::-webkit-scrollbar-thumb:hover {
    background: var(--color-scrollbar-thumb-hover, #0066b8);
}

.scrollbar-theme-thin::-webkit-scrollbar-thumb:active {
    background: var(--color-scrollbar-thumb-active, #004d99);
}
</style>
