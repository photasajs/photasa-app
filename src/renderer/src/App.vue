<script setup lang="ts">
import { computed, ref, inject } from "vue";
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
import { deepCopy, getNextScanItem } from "./utils/object";
import { scanPhotosTask } from "@renderer/utils/scan-folder";
import { startFileWatching } from "./utils/file-handler";
import { loggers } from "@common/logger";
import { mapFileOperationToScanAction } from "@common/file-operation-utils";

import UserPreference from "./components/UserPreference.vue";
import ScanQueueDialog from "./components/ScanQueueDialog.vue";
import { useI18n } from "vue-i18n";
import { useTitle, watchArray } from "@vueuse/core";
import { useStatusBarStore } from "@renderer/stores/statusBar";
import { FindPhotoServiceKey } from "@renderer/interface/find-photo-service.interface";
import { themeManager, ThemeMeta } from "@renderer/services/theme-manager";
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
} from "@renderer/components/ui";
import QueueHealthDashboard from "./components/queue-monitoring/QueueHealthDashboard.vue";
import { queueMonitoringService } from "@renderer/services/queue-monitoring-service";

/**
 * 日志记录器
 */
const logger = loggers.app;

const { t } = useI18n();
const photosStore = usePhotosStore();
const { processingFile } = storeToRefs(photosStore);
const preferenceStore = usePreferenceStore();
const { paths, currentFolder, scanningFolder, thumbnailSize } = storeToRefs(preferenceStore);
const { addPath, completeScanPath, addScanFolder, updateFolderTree } = preferenceStore;

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

onMounted(async () => {
    // APP 启动时推送初始化状态
    statusBarStore.update({
        type: "app",
        status: "initializing",
        task: t("app.title"),
        timestamp: Date.now(),
    });
    await themeManager.loadBuiltInThemes();
    themes.value = themeManager.getThemes();
    const cur = themeManager.getCurrentTheme();
    currentThemeId.value = cur?.id || themes.value[0]?.id || "";
    // 主题加载完毕，切换为 ready 状态
    statusBarStore.update({
        type: "app",
        status: "ready",
        task: t("app.title"),
        timestamp: Date.now(),
    });
    // 应用启动时全局初始化菜单栏数据（国际化）
    menusStore.refreshMenus(t);
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

// 包装 addScanFolder 增加日志
const addScanFolderWithLog = (folder: string, action: "scan" | "rescan" | "current") => {
    logger.debug(`[addScanFolderWithLog] Attempting to add folder: ${folder}, action: ${action}`);
    logger.debug(
        `[addScanFolderWithLog] Current scanningFolder before:`,
        scanningFolder.value.map((f) => f.path),
    );

    // 检查是否已存在
    const existingIndex = scanningFolder.value.findIndex((f) => f.path === folder);
    if (existingIndex >= 0) {
        logger.debug(
            `[addScanFolderWithLog] Folder already exists at index ${existingIndex}, skipping: ${folder}`,
        );
        return;
    }

    addScanFolder(folder, action);
    logger.debug(`[addScanFolderWithLog] Successfully added folder: ${folder}`);
    logger.debug(
        `[addScanFolderWithLog] Current scanningFolder after:`,
        scanningFolder.value.map((f) => f.path),
    );
};

watchArray(
    scanningFolder,
    () => {
        logger.debug(
            "watchArray scanningFolder triggered",
            scanningFolder.value,
            scanPhotosTask.isIdle,
        );
        if (scanPhotosTask.isIdle) {
            logger.debug("scanPhotosTask is idle, calling startScanning");
            startScanning();
        } else {
            logger.debug("scanPhotosTask is not idle, will retry in 500ms");
            setTimeout(() => {
                if (scanPhotosTask.isIdle) {
                    logger.debug("scanPhotosTask became idle, retrying startScanning");
                    startScanning();
                } else {
                    logger.debug("scanPhotosTask still not idle after 500ms");
                }
            }, 500);
        }
    },
    { deep: true },
);

async function startScanning(): Promise<void> {
    logger.debug(
        `startScanning called, folders count: ${scanningFolder.value.length}, isIdle: ${scanPhotosTask.isIdle}`,
    );
    if (scanningFolder.value.length > 0) {
        const nextItem = getNextScanItem(scanningFolder.value);
        if (!nextItem) {
            logger.warn("No scan item found despite scanningFolder having items");
            return;
        }
        const scanAction = deepCopy(nextItem);
        processingFile.value = "正在扫描: " + scanAction.path;
        logger.debug(`Starting scan for path: ${scanAction.path}, action: ${scanAction.action}`);
        if (scanAction.action === "rescan") {
            logger.debug(`Rescanning folder: ${scanAction.path}`);
            await resetPhotasaConfig(scanAction.path);
        }

        scanAction.thumbnailSize = thumbnailSize.value;
        logger.debug(`Scanning subfolders for: ${scanAction.path}`);
        try {
            const folders = await scanSubfolders(scanAction.path);
            logger.debug(`Found ${folders.length} subfolders for: ${scanAction.path}`, folders);

            // 记录添加子文件夹前的队列状态
            logger.debug(
                `Before adding subfolders, scanningFolder length: ${scanningFolder.value.length}`,
                scanningFolder.value.map((f) => f.path),
            );

            folders.forEach((f: string) => addScanFolderWithLog(f, "scan"));

            // 记录添加子文件夹后的队列状态
            logger.debug(
                `After adding subfolders, scanningFolder length: ${scanningFolder.value.length}`,
                scanningFolder.value.map((f) => f.path),
            );

            logger.debug(`Starting scanPhotosTask for: ${scanAction.path}`);
            const args = await scanPhotosTask.perform(scanAction);
            logger.debug(`Scan completed for: ${scanAction.path}`);

            // 记录清理前的队列状态
            logger.debug(
                `Before cleanup, scanningFolder length: ${scanningFolder.value.length}`,
                scanningFolder.value.map((f) => f.path),
            );

            // 无论扫描结果如何，都要清理scanningFolder中的项目，避免死循环
            logger.debug(`Cleaning up scan path: ${scanAction.path}`);
            completeScanPath(scanAction.path);

            // 记录清理后的队列状态
            logger.debug(
                `After cleanup, scanningFolder length: ${scanningFolder.value.length}`,
                scanningFolder.value.map((f) => f.path),
            );

            // 如果扫描成功且有结果，更新文件夹树
            if (args?.action?.path && args?.action?.isDirectory) {
                logger.debug(`Updating folder tree for: ${args.action.path}`);
                updateFolderTree(args.action.path as string);
            }

            // 继续处理下一个扫描项目
            startScanning();
        } catch (error) {
            logger.error("Error during scanning:", error);
            completeScanPath(scanAction.path);
            processingFile.value = "扫描失败: " + scanAction.path;
            startScanning();
        }
    } else {
        logger.debug("No folders to scan");
    }
}

getDirectory("desktop")
    .then((dir) => {
        // Desktop directory is ready
        if (paths.value.length === 0) {
            addPath(dir);
        }

        loading.value = false;

        // Set to current folder
        currentFolder.value = paths.value[0];
        if (paths.value.length > 0) {
            startFileWatching(paths.value, preferenceStore);
        } else {
            // Open preference to config
            showPreference.value = true;
        }
        return paths.value;
    })
    .then(() => {
        processingFile.value = t("status.loadingConfig");
        // Start to check if any leftover folder need to scan
        startScanning();
    });

function handlePreferenceOk(): void {
    showPreference.value = false;
}
// Update title
const title = computed(() => {
    return `${t("app.title")} - ${currentFolder.value}`;
});
useTitle(title);

// 监听 find-photo 事件，用于刷新树结构
findPhotoService.onFindPhoto((args: any) => {
    logger.debug("onFindPhoto received:", args.type, args.action?.path, args.progress);

    // 处理进度更新 - 更新scanningFolder中对应项目的progress信息
    if (args.progress && args.action?.path) {
        const targetIndex = scanningFolder.value.findIndex(
            (item) => item.path === args.action.path,
        );
        if (targetIndex >= 0) {
            logger.debug(
                `Updating progress for ${args.action.path}: ${args.progress.processed}/${args.progress.total}`,
            );
            scanningFolder.value[targetIndex].progress = {
                processed: args.progress.processed || 0,
                total: args.progress.total || 0,
                cacheEnabled: true,
            };
        }

        // 更新当前处理的文件信息到状态栏
        if (args.currentFile) {
            processingFile.value = `正在扫描: ${args.action.path} - ${args.currentFile}`;
        } else {
            processingFile.value = `正在扫描: ${args.action.path}`;
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
    logger.debug(`Received ${operations.length} file operations from watch service`);

    // Process batch of file operations
    operations.forEach((operation) => {
        logger.debug("Adding file operation to queue:", operation);

        // Convert FileOperation to enhanced ScanAction for unified processing
        const fileOperation = {
            path: operation.path,
            action: mapFileOperationToScanAction(operation.type),
            thumbnailSize: operation.metadata?.thumbnailSize || thumbnailSize.value,
            operationType: (operation.metadata?.isFile ? "file" : "directory") as
                | "file"
                | "directory",
            priority: operation.priority,
            retryCount: operation.retryCount,
            createdAt: operation.timestamp,
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

    <!-- Portal提供者 - 为下拉菜单等组件提供渲染目标 -->
    <PortalProvider />
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
