<script setup lang="ts">
import { computed, ref, inject, onUnmounted, watch } from "vue";
import { storeToRefs } from "pinia";
import ImportPhotos from "./components/ImportPhotos.vue";
import SplitView from "./components/SplitView.vue";
import ImageList from "./components/ImageList.vue";
import FolderList from "./components/FolderList.vue";
import { usePhotosStore } from "@renderer/stores/photos";
import { usePreferenceStore } from "@renderer/stores/preference";
import { getDirectory, stopWatching } from "@renderer/utils/api";
// deepCopy removed as no longer needed
// ✅ RFC 0048: orchestrateScan 已迁移到 YuChiGong
// ✅ RFC 0048: scanPhotosTask, waitForTaskIdle 已不再使用
import { scanPhotosTask } from "@renderer/utils/scan-folder";
import { startFileWatching } from "./utils/file-handler";
import { loggers } from "@common/logger";
import { mapFileOperationToScanAction } from "@common/file-operation-utils";
import type { FindPhotoEvent, FileOperation } from "@common/scan-types";

import UserPreference from "./components/UserPreference.vue";
import ScanQueueDialog from "./components/ScanQueueDialog.vue";
import { useI18n } from "vue-i18n";
import { useTitle, watchArray } from "@vueuse/core";
import { useStatusBarStore } from "@renderer/stores/statusBar";
import { FindPhotoServiceKey } from "@renderer/interfaces/find-photo-service.interface";
import type { ThemeMeta } from "@/services/chusuiliang/theme-manage";
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
import { useChuSuiLiang } from "@renderer/composables/useChuSuiLiang";
import { useYuChiGong } from "@renderer/composables/useYuChiGong";
import { useQinQiong } from "@renderer/composables/useQinQiong";
// ✅ RFC 0048: useWeiZheng 不再直接在 App.vue 使用
// import { useWeiZheng } from "./composables/useWeiZheng";

/**
 * 日志记录器
 */
const logger = loggers.lishimin;
const themeManager = useChuSuiLiang().themeManager;
const { t } = useI18n();
const photosStore = usePhotosStore();
const { processingFile } = storeToRefs(photosStore);
const preferenceStore = usePreferenceStore();
const { paths, currentFolder, thumbnailSize } = storeToRefs(preferenceStore);
const { addPath } = preferenceStore;

/**
 * YuChiGong service
 */
const yuChiGong = useYuChiGong();

/**
 * QinQiong service
 */
const qinQiong = useQinQiong();

// ✅ RFC 0048: weiZheng 不再直接在 App.vue 使用，通过启奏-圣旨协调
// const weiZheng = useWeiZheng();

// 初始化更新监听器
const { updateStore } = useUpdateListener();

// ✅ RFC 0042: 使用尉迟恭获取扫描队列，不直接访问store
const scanningFolder = computed(() => yuChiGong.scanningQueue);

// 使用对话框管理器统一管理对话框状态
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
    logger.debug("Opening scan list dialog...");
    showScanList.value = true;
}
function handleOpenQueueDashboard() {
    logger.debug("Opening queue dashboard dialog...");
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
    logger.debug("Opening preference dialog...");
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
            // ✅ RFC 0042: 使用秦琼处理文件系统事件
            startFileWatching(paths.value, preferenceStore, qinQiong);
        } else {
            // Open preference to config
            showPreference.value = true;
        }

        processingFile.value = t("status.loadingConfig");
        // ✅ RFC 0048: 尉迟恭会自动处理扫描
    } catch (error) {
        logger.error("👑 李世民登基失败:", error);
        loading.value = false;
        // Open preference to config on error
        showPreference.value = true;
    }
}

const chuSuiLiang = useChuSuiLiang();

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
    const storeThemeId = chuSuiLiang.currentTheme;
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
        () => preferenceStore.ui.theme,
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
        logger.info("👑 [扫描监控] 自动恢复触发");
        // ✅ RFC 0048: 尉迟恭的watch会自动触发扫描
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
            startFileWatching(paths.value, preferenceStore, qinQiong);
        });
    },
    { deep: true },
);

// ✅ RFC 0042: addScanFolder 已废弃，不再需要 addScanFolderWithLog
// 添加 watched folder 后，李世民路由会自动触发尉迟恭添加扫描任务

// ✅ RFC 0048: 尉迟恭自动处理扫描，App.vue 只监听队列更新 UI
watch(
    () => yuChiGong.scanningQueue,
    (newQueue) => {
        if (newQueue.length > 0) {
            processingFile.value = t("status.scanningPath", { path: newQueue[0].path });
        } else {
            processingFile.value = "";
        }
    },
    { deep: true },
);

// ✅ RFC 0048: callbacks 和 startScanning 已废弃，逻辑迁移到尉迟恭

function handlePreferenceOk(): void {
    logger.debug("Closing preference dialog...");
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

// 监听 Scan Service find-photo 通知事件，用于刷新状态栏
// 🔧 状态栏路径显示修复：processScannedFileTask 回调中增强了路径构造逻辑
// 相关修改：将 args.currentFile (文件名) 与 args.action.path (目录路径) 结合，构造完整文件路径
findPhotoService.onFindPhoto((args: FindPhotoEvent) => {
    logger.debug("👑 onFindPhoto received:", args.type, args.action?.path, args.progress);

    // 记录扫描活动（表示有进展）
    if (args.progress || args.type === "complete") {
        scanMonitoringService.recordActivity();
    }

    // ❌ RFC 0042: UI层不应该更新进度
    // 进度更新应该由千里眼（Qianliyan）在底层自动同步到store
    // UI只负责读取和显示 scanningFolder（通过 yuChiGong.scanningQueue）
    // 进度数据会通过 store automation 自动从后端响应同步

    if (args.action?.path) {
        // 更新当前处理的文件信息到状态栏
        // 🔧 修复：正确处理文件路径和目录路径
        // 问题：当 action.path 是文件路径时，不应该再拼接 currentFile
        // 修复：如果 action.path 是文件路径（isDirectory: false），直接使用；否则构造路径
        if (args.action.isDirectory === false) {
            // action.path 是文件路径，直接使用
            processingFile.value = `${t("status.scanning")} ${args.action.path}`;
        } else if (args.currentFile) {
            // action.path 是目录路径，需要拼接文件名
            const fullFilePath = `${args.action.path}/${args.currentFile}`.replace(/\/+/g, "/");
            processingFile.value = `${t("status.scanning")} ${fullFilePath}`;
        } else {
            // action.path 是目录路径，但没有文件名，显示目录路径
            processingFile.value = `${t("status.scanning")} ${args.action.path}`;
        }
    }

    // ✅ RFC 0042 Step 2.5: folderTree更新已完全迁移到天界
    // App.vue只负责UI状态，不再直接修改folderTree
    //
    // 数据流：
    //   袁天罡监听IPC → 启奏李世民 → 褚遂良持久化 → 天界工作流
    //   → Store Automation自动同步 → Vue响应式更新UI
    //
    // App.vue只需要清理UI状态，folderTree会通过Store自动更新

    // 批量刷新树结构
    if (args.type === "complete" && Array.isArray(args.paths)) {
        // ❌ 已删除：args.paths.forEach((p: string) => updateFolderTree(p));
        // ✅ 袁天罡会触发天界持久化 → Store Automation自动同步

        // 清理处理文件状态
        processingFile.value = "";
        // ✅ RFC 0048: 扫描队列管理已迁移到尉迟恭，自动处理，无需手动干预
    } else if (args?.action?.path && args?.action?.isDirectory) {
        // 单个刷新树结构
        // ❌ 已删除：updateFolderTree(args.action.path as string);
        // ✅ 袁天罡会触发天界持久化 → Store Automation自动同步

        // 如果是单个完成事件，也清理处理文件状态
        if (args.type === "complete") {
            processingFile.value = "";
        }
        // 注意：不要在这里调用completeScanPath和startScanning，因为startScanning函数内部已经处理了这些逻辑
    }
});

// 监听统一队列事件，处理文件监视产生的批量操作
window.api?.onScanQueueAdd((operations: FileOperation[]) => {
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
                        <ImageList
                            @import="
                                () => {
                                    showImportDialog = true;
                                }
                            "
                        />
                        <ImportPhotos
                            :show="showImportDialog"
                            @update:show="
                                (value) => {
                                    showImportDialog = value;
                                }
                            "
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
        @close="
            () => {
                showScanList = false;
            }
        "
    />
    <BaseModal
        :open="showQueueDashboard"
        title="队列健康监控"
        size="custom"
        :style="{ '--modal-width': '1200px' }"
        @close="
            () => {
                showQueueDashboard = false;
                queueMonitoringService.stopMonitoring();
            }
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
