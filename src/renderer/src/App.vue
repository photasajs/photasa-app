<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import { computed, ref, watch, inject, h } from "vue";
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
import type { ScanAction } from "src/preload/types";
import { useTitle, watchArray } from "@vueuse/core";
import { SettingOutlined, ImportOutlined, CoffeeOutlined } from "@ant-design/icons-vue";
import { useStatusBarStore } from "@renderer/stores/statusBar";
import { FindPhotoServiceKey } from "@renderer/interface/IFindPhotoService";

const logger = loggers.app;

const { t } = useI18n();
const photosStore = usePhotosStore();
const { processingFile } = storeToRefs(photosStore);
const preferenceStore = usePreferenceStore();
const { paths, darkMode, currentFolder, scanningFolder, thumbnailSize } =
    storeToRefs(preferenceStore);
const { addPath, completeScanPath, addScanFolder, updateFolderTree } = preferenceStore;
const statusBarStore = useStatusBarStore();

const showImport = ref(false);
const showPreference = ref(false);
const showScanList = ref(false);
const loading = ref(false);
const loadingConfigs = ref(false);

const findPhotoService = inject(FindPhotoServiceKey);
if (!findPhotoService) throw new Error("FindPhotoService not provided");

function updateTheme(): void {
    if (darkMode.value) {
        document.body.classList.add("dark");
        document.body.classList.remove("light");
    } else {
        document.body.classList.remove("dark");
        document.body.classList.add("light");
    }
}

// Set Dark/Light theme node
watch(darkMode, () => {
    updateTheme();
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
function openPreference(): void {
    showPreference.value = true;
}
function openImportPhotos(): void {
    showImport.value = true;
}
function openScanList(): void {
    showScanList.value = true;
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
        <header class="app-header">
            <a-space class="title-header">
                <a-typography-text type="primary">{{ t("app.title") }}</a-typography-text>
            </a-space>
            <a-space class="setting-header">
                <CoffeeOutlined class="system-icon" @click="openScanList"></CoffeeOutlined>
                <ImportOutlined class="system-icon" @click="openImportPhotos"></ImportOutlined>
                <SettingOutlined class="system-icon" @click="openPreference" />
            </a-space>
        </header>
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
                            <ImageList></ImageList>
                        </a-layout-content>
                    </a-layout>
                </template>
            </split-view>
        </a-layout>
        <footer class="app-footer">
            <a-space>
                <a-typography-text type="success">
                    <!-- 优先展示主进程推送的任务状态，支持国际化 -->
                    <template v-if="statusBarStore.status">
                        {{ t(`status.${statusBarStore.status}`) }}
                        <span v-if="statusBarStore.currentTask"
                            >: {{ statusBarStore.currentTask }}</span
                        >
                        <span v-if="statusBarStore.progress !== undefined">
                            ({{ statusBarStore.progress }}%)</span
                        >
                        <span v-if="statusBarStore.error">
                            [{{ t("notification.error") }}: {{ statusBarStore.error }}]</span
                        >
                    </template>
                    <template v-else>
                        {{ processingFile }}
                    </template>
                </a-typography-text>
            </a-space>
        </footer>
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
        :title="t('scan.queueTitle') || '扫描队列'"
        width="600px"
        :footer="[
            h(
                'a-button',
                {
                    type: 'primary',
                    onClick: () => (showScanList = false),
                },
                t('button.ok') || 'OK',
            ),
        ]"
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
    </a-modal>
</template>

<style lang="less">
:root {
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

.app-header {
    height: var(--photasa-header-height);
    margin-left: 36px;
    padding-left: 50px;
    line-height: 36px;
    display: flex;
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
