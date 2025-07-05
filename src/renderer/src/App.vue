<!-- eslint-disable @typescript-eslint/no-unused-vars -->
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
import { deepCopy, top } from "./utils/object";
import { scanPhotosTask } from "@renderer/utils/scan-folder";
import { startFileWatching } from "./utils/file-handler";
import { loggers } from "@common/logger";

import UserPreference from "./components/UserPreference.vue";
import { useI18n } from "vue-i18n";
import type { ScanAction } from "@common/scan-types";
import { useTitle, watchArray } from "@vueuse/core";
import { useStatusBarStore } from "@renderer/stores/statusBar";
import { FindPhotoServiceKey } from "@renderer/interface/find-photo-service.interface";
import { themeManager, ThemeMeta } from "@renderer/services/theme-manager";
import { onMounted } from "vue";
import StatusBar from "./components/common/StatusBar.vue";
import TitlebarMac from "./components/TitlebarMac.vue";
import TitlebarWinLinux from "./components/TitlebarWinLinux.vue";

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

const showImport = ref(false);
const showPreference = ref(false);
const showScanList = ref(false);
const loading = ref(false);
const loadingConfigs = ref(false);

// 控制导入对话框显隐的响应式变量
const showImportDialog = ref(false);

const findPhotoService = inject(FindPhotoServiceKey);
if (!findPhotoService) {
    throw new Error("FindPhotoService not provided");
}

const themes = ref<ThemeMeta[]>([]);
const currentThemeId = ref<string>("");
const statusBarStore = useStatusBarStore();

const isMac = window.api.isMac();

function handleOpenScanList() {
    showScanList.value = true;
}
function handleOpenImportPhotos() {
    showImportDialog.value = true;
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
    logger.debug("addScanFolder called", folder, action, scanningFolder.value);
    addScanFolder(folder, action);
    logger.debug("addScanFolder after", scanningFolder.value);
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
        "startScanning called, scanningFolder:",
        scanningFolder.value,
        "isIdle:",
        scanPhotosTask.isIdle,
    );
    if (scanningFolder.value.length > 0) {
        const scanAction = deepCopy(top<ScanAction>(scanningFolder.value));
        processingFile.value = "正在扫描: " + scanAction.path;
        logger.debug("Starting scan for action:", scanAction);
        if (scanAction.action === "rescan") {
            logger.debug("Rescanning folder:", scanAction.path);
            await resetPhotasaConfig(scanAction.path);
        }

        scanAction.thumbnailSize = thumbnailSize.value;
        logger.debug("Scanning subfolders for:", scanAction.path);
        try {
            const folders = await scanSubfolders(scanAction.path);
            logger.debug("Found subfolders:", folders);
            folders.forEach((f: string) => addScanFolderWithLog(f, "scan"));

            logger.debug("Starting scanPhotosTask for:", scanAction);
            const args = await scanPhotosTask.perform(scanAction);
            logger.debug("Scan completed with args:", args);

            if (args?.action?.path && args?.action?.isDirectory) {
                logger.debug("Updating folder tree for:", args.action.path);
                updateFolderTree(args.action.path as string);
                completeScanPath(args.action.path as string);
                startScanning();
            }
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
    // 批量刷新树结构
    if (args.type === "complete" && Array.isArray(args.paths)) {
        args.paths.forEach((p: string) => updateFolderTree(p));
        completeScanPath(args.action.path);
        startScanning();
    } else if (args?.action?.path && args?.action?.isDirectory) {
        // 单个刷新树结构
        updateFolderTree(args.action.path as string);
        completeScanPath(args.action.path as string);
        startScanning();
    }
});
</script>

<template>
    <a-spin v-if="loading" />
    <a-layout v-else>
        <!-- 分平台 titlebar -->
        <TitlebarMac
            v-if="isMac"
            @openScanList="handleOpenScanList"
            @openImportPhotos="handleOpenImportPhotos"
            @openPreference="handleOpenPreference"
        />
        <TitlebarWinLinux
            v-else
            @openScanList="handleOpenScanList"
            @openImportPhotos="handleOpenImportPhotos"
            @openPreference="handleOpenPreference"
        />
        <!-- 其余内容保持不变 -->
        <a-layout class="content app-container">
            <split-view direction="horizontal" a-init="350px" a-min="200px" a-max="600px">
                <template #A>
                    <a-layout class="image-content">
                        <a-layout-content>
                            <a-spin :spinning="loadingConfigs">
                                <FolderList></FolderList>
                            </a-spin>
                        </a-layout-content>
                    </a-layout>
                </template>
                <template #B>
                    <a-layout class="image-content">
                        <a-layout-content class="image-list">
                            <ImageList @import="showImportDialog = true" />
                            <ImportPhotos
                                :show="showImportDialog"
                                @update:show="showImportDialog = $event"
                            />
                        </a-layout-content>
                    </a-layout>
                </template>
            </split-view>
        </a-layout>
        <StatusBar />
    </a-layout>
    <ImportPhotos v-model:show="showImport"></ImportPhotos>
    <a-modal
        v-model:visible="showPreference"
        :mask-closable="false"
        :title="t('preference.settings')"
        width="800px"
        @ok="handlePreferenceOk"
    >
        <UserPreference></UserPreference>
        <template #footer></template>
    </a-modal>
    <a-modal
        v-model:visible="showScanList"
        :mask-closable="false"
        :title="t('scan.queueTitle')"
        width="600px"
    >
        <a-list size="small" bordered :data-source="scanningFolder" class="scan-list">
            <template #renderItem="{ item }">
                <a-list-item>
                    <span>{{ item.path }}</span>
                    <span style="float: right; color: #888">{{ item.action }}</span>
                </a-list-item>
            </template>
            <template #header>
                <a-spin v-if="scanningFolder.length > 0" />
                <span v-else>{{ t("scan.queueEmpty") || "队列为空" }}</span>
            </template>
        </a-list>
        <template #footer>
            <a-button
                type="primary"
                size="large"
                block
                style="margin: 0 auto; width: 120px"
                @click="showScanList = false"
            >
                {{ t("button.ok") }}
            </a-button>
        </template>
    </a-modal>
</template>

<style lang="less">
:root {
    /* 主题变量控制 footer 高度 */
    --photasa-footer-height: 70px;
    --photasa-hear-height: 36px;
}
.content .image-content {
    height: calc(100vh - var(--photasa-footer-height));
    overflow-y: overlay;
    margin: auto;
}

.image-list {
    margin: 0;
    height: 100%;
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

.scan-list {
    height: 10rem;
    overflow: auto;
    overflow-y: overlay;
}

.system-icon {
    height: 1.5ren;
    width: 1.5rem;
}
</style>
