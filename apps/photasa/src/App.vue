<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from "vue";
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
    getRecoverableImports,
    cleanupRecoverableImport,
    keepRecoverableImport,
} from "@renderer/utils/api";
import { scanPhotosTask } from "@renderer/utils/scan-folder";
import { startFileWatching } from "./utils/file-handler";
import { loggers } from "@photasa/common";
import { getPhotasaApi } from "@renderer/ipc/api-access";

import UserPreference from "./components/UserPreference.vue";
import ScanQueueDialog from "./components/ScanQueueDialog.vue";
import { useI18n } from "vue-i18n";
import { useTitle, watchArray } from "@vueuse/core";
import type { ThemeMeta } from "@/services/chusuiliang/theme-manage";
import { onMounted } from "vue";
import StatusBar from "./components/common/StatusBar.vue";
import ImportProgressChip from "./components/ImportProgressChip.vue";
import TitlebarMac from "./components/TitlebarMac.vue";
import TitlebarWinLinux from "./components/TitlebarWinLinux.vue";
import { useZhangSunWuJi } from "@renderer/composables/useZhangSunWuJi";
import {
    NotificationContainer,
    PortalProvider,
    BaseModal,
    BaseSpinner,
    UpdateNotification,
} from "@renderer/components/ui";
import QueueHealthDashboard from "./components/queue-monitoring/QueueHealthDashboard.vue";
import { queueMonitoringService } from "@renderer/services/queue-monitoring-service";
import { scanMonitoringService } from "@renderer/services/yushinan/scan-monitoring-service";
import LogConsole from "./components/LogConsole.vue";
import { useUpdateListener } from "@renderer/composables/useUpdateListener";
import { useChuSuiLiang } from "@renderer/composables/useChuSuiLiang";
import { useQinQiong } from "@renderer/composables/useQinQiong";
import { useWeiZheng } from "@renderer/composables/useWeiZheng";
import { useScanningStore } from "@renderer/services/fangxuanling/stores/scanning-store";
import { isTauri } from "./api/env";
import { THEME_BASE_PATH } from "@renderer/constants/theme-base-path";
import { notification } from "@renderer/services/notification-manager";
import type { RecoverableImport } from "@photasa/common";

/**
 * 日志记录器
 */
const logger = loggers.lishimin;
const themeManager = useChuSuiLiang().themeManager;
const chuSuiLiang = useChuSuiLiang();
const { t } = useI18n();
const preferenceStore = usePreferenceStore();
const { paths, currentFolder } = storeToRefs(preferenceStore);

/**
 * QinQiong service
 */
const qinQiong = useQinQiong();

// 初始化更新监听器
const { updateStore } = useUpdateListener();

// RFC 0042 + 0144：Pinia storeToRefs 保证队列 UI 响应磁盘恢复与 matter-sync
const { queue: scanningFolder } = storeToRefs(useScanningStore());

// 使用对话框管理器统一管理对话框状态
const showImportDialog = ref(false);
const showPreference = ref(false);
const showScanList = ref(false);
const showQueueDashboard = ref(false);
const loading = ref(false);

const themes = ref<ThemeMeta[]>([]);
const currentThemeId = ref<string>("");
// ✅ RFC 0057: statusBarStore 已迁移到 yuShiNan 服务管理，通过房玄龄访问
const zhangSunWuJi = useZhangSunWuJi();

const isMac = ref(false);
void getPhotasaApi()
    .isMac()
    .then((value) => {
        isMac.value = Boolean(value);
    })
    .catch(() => {
        isMac.value = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
    });

// ⚠️ Do NOT auto-open showScanList modal when queue receives tasks.
// Users can open the queue modal manually when desired.

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
            await chuSuiLiang.addPath(dir);
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
        // ✅ RFC 0048: 尉迟恭会自动处理扫描
    } catch (error) {
        logger.error("👑 李世民登基失败:", error);
        loading.value = false;
        // Open preference to config on error
        showPreference.value = true;
    }
}

async function cleanupInterruptedImport(item: RecoverableImport): Promise<void> {
    const result = await cleanupRecoverableImport(item.id);
    if (result.success) {
        notification.success({
            title: t("import.recovery.cleanedTitle"),
            message: t("import.recovery.cleanedMessage", {
                count: result.deletedFiles?.length ?? 0,
            }),
        });
        return;
    }
    notification.error({
        title: t("import.recovery.cleanupFailedTitle"),
        message: t("import.recovery.cleanupFailedMessage"),
    });
}

async function keepInterruptedImport(item: RecoverableImport): Promise<void> {
    const result = await keepRecoverableImport(item.id);
    notification.info({
        title: t("import.recovery.keptTitle"),
        message: t("import.recovery.keptMessage", {
            count: result.keptFiles ?? item.fileList.length,
        }),
    });
}

function notifyInterruptedImport(item: RecoverableImport): void {
    notification.warning({
        key: `import-recovery-${item.id}`,
        duration: 0,
        title: t("import.recovery.title"),
        message: t("import.recovery.message", {
            copied: item.fileList.length,
            total: item.totalFiles,
        }),
        actions: [
            {
                text: t("import.recovery.cleanup"),
                type: "danger",
                onClick: () => {
                    void cleanupInterruptedImport(item);
                },
            },
            {
                text: t("import.recovery.keep"),
                type: "secondary",
                onClick: () => {
                    void keepInterruptedImport(item);
                },
            },
        ],
    });
}

async function detectRecoverableImports(): Promise<void> {
    if (!isTauri()) return;
    try {
        const imports = await getRecoverableImports();
        imports.forEach(notifyInterruptedImport);
    } catch (error) {
        logger.warn("⚠️ 导入恢复检查失败", error);
    }
}

const weiZheng = useWeiZheng();
const scanningStore = useScanningStore();

onMounted(async () => {
    // 应用启动时全局初始化菜单栏数据（国际化）
    await themeManager.loadBuiltInThemes();
    themes.value = themeManager.getThemes();

    // 获取Store中的主题设置
    const storeThemeId = chuSuiLiang.currentTheme;
    currentThemeId.value = storeThemeId || themes.value[0]?.id || "";

    // 应用主题到DOM
    if (currentThemeId.value) {
        try {
            await themeManager.applyTheme(currentThemeId.value, THEME_BASE_PATH);
            logger.info("👑 应用主题成功:", currentThemeId.value);
        } catch (error) {
            logger.error("👑 应用主题失败:", error);
        }
    }

    // 应用启动时全局初始化菜单栏数据（国际化）
    zhangSunWuJi.refreshMenus(t);

    // 监听Store中主题变化，自动应用主题
    watch(
        () => preferenceStore.ui.theme,
        async (newThemeId) => {
            if (newThemeId && newThemeId !== currentThemeId.value) {
                try {
                    await themeManager.applyTheme(newThemeId, THEME_BASE_PATH);
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
    queueMonitoringService.setQueueProvider(() => scanningStore.queue);
    scanMonitoringService.startMonitoring(() => {
        logger.info("👑 [扫描监控] 自动恢复触发");
        // ✅ RFC 0048: 尉迟恭的watch会自动触发扫描
    });

    // Initialize the application
    try {
        await initializeApp();
        await detectRecoverableImports();
    } finally {
        // RFC 0101：主界面首屏就绪后关闭 Splash、显示主窗
        if (isTauri()) {
            try {
                const { invoke } = await import("@tauri-apps/api/core");
                await invoke("close_splashscreen");
            } catch (e) {
                logger.warn("⚠️ 告示：关闭启动画面未果", e);
            }
        }
    }
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

function handlePreferenceOk(): void {
    logger.debug("Closing preference dialog...");
    showPreference.value = false;
}

// 更新处理函数
function handleUpdateInstall(): void {
    updateStore.startDownload();
    void getPhotasaApi().downloadUpdate?.();
}

function handleUpdateInstallNow(): void {
    void getPhotasaApi().installUpdate?.();
}
// Update title
const title = computed(() => {
    return `${t("app.title")} - ${currentFolder.value}`;
});
useTitle(title);

// RFC 0137：picasa:add-to-scan-queue 由袁天罡 listen → 李世民 → 尉迟恭处理（不再在 App.vue 订阅）
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
        <div class="import-chip-dock">
            <ImportProgressChip />
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

.import-chip-dock {
    display: flex;
    justify-content: flex-end;
    padding: 0 0.75rem 0.35rem;
    pointer-events: none;
}

.import-chip-dock > * {
    pointer-events: auto;
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
    height: 18px;
    width: 18px;
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
