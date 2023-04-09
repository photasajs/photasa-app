<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import ImportPhotos from "./components/ImportPhotos.vue";
import SplitView from "./components/SplitView.vue";
import ImageList from "./components/ImageList.vue";
import FolderList from "./components/FolderList.vue";
import { usePhotosStore } from "@renderer/stores/photos";
import { usePreferenceStore } from "@renderer/stores/preference";
import {
    startWatching,
    getDirectory,
    stopWatching,
    loadPhotasaConfigs,
    resetPhotasaConfig,
    scanSubfolders,
} from "@renderer/utils/api";
import { processScannedFileTask, scanPhotosTask } from "@renderer/utils/scan-folder";
import { handleAddFileTask, handleDeleteFileTask } from "./utils/file-list";
import { deepCopy } from "./utils/object";
import Preference from "./components/Preference.vue";
import { useI18n } from "vue-i18n";
import type { WatchState, ScanArgs, ScanAction } from "src/preload/types";
import { useTitle, watchArray } from "@vueuse/core";
import { SettingOutlined, ImportOutlined, CoffeeOutlined } from "@ant-design/icons-vue";

const { t } = useI18n();
const photosStore = usePhotosStore();
const { processingFile } = storeToRefs(photosStore);
const { addPhotasaConfigFile, addPhotasaConfigFiles } = photosStore;
const preferenceStore = usePreferenceStore();
const { paths, darkMode, currentFolder, scanningFolder, thumbnailSize, scannedFolder } =
    storeToRefs(preferenceStore);
const { addPath, completeScanPath, addScanFolder } = preferenceStore;

const showImport = ref(false);
const showPreference = ref(false);
const showScanList = ref(false);
const loading = ref(false);
const loadingConfigs = ref(false);

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
            startFileWatching(paths.value);
        });
    },
    { deep: true },
);

const queue: ScanArgs[] = [];

function runOverQueue(): void {
    const args = queue.shift();
    if (args?.action?.path) {
        processScannedFileTask.perform(args, thumbnailSize.value).then(() => {
            addPhotasaConfigFile(paths.value, {
                path: args?.action?.path ?? "",
                thumbnail: "",
            });
            processingFile.value = args.action?.path as string;
            runOverQueue();
        });
    } else {
        completeScanPath(scannedFolder.value);
    }
}

function top<T>(array): T {
    return array[array.length - 1];
}

async function startScanning(): Promise<void> {
    if (scanningFolder.value.length > 0) {
        const scanAction = deepCopy(top<ScanAction>(scanningFolder.value));
        if (scanAction.action === "rescan") {
            await resetPhotasaConfig(scanAction.path);
        }

        scanAction.thumbnailSize = thumbnailSize.value;
        // Each time only scan one level of subfolders, and expand the subfolders
        scanSubfolders(scanAction.path).then((folders) => {
            folders.forEach((f) => addScanFolder(f, "scan"));
            return scanPhotosTask.perform(scanAction).then((args: ScanArgs) => {
                processingFile.value = t("status.scanned");
                if (args?.action?.path) {
                    addPhotasaConfigFile(paths.value, {
                        path: args?.action?.path ?? "",
                        thumbnail: "",
                        isVideo: false,
                    });
                    completeScanPath(args.action.path as string);
                    startScanning();
                }
            });
        });
    }
}

watchArray(
    scanningFolder,
    () => {
        if (scanPhotosTask.isIdle) {
            startScanning();
        }
    },
    { deep: true },
);

const actions = {
    add: handleAddFileTask,
    delete: handleDeleteFileTask,
};

function startFileWatching(dirs): void {
    // start watching folders
    startWatching(
        {
            paths: deepCopy(dirs),
        },
        (state: WatchState) => {
            const handler = actions[state.action ?? ""];
            handler?.perform(state, photosStore, preferenceStore);
        },
    );
}

const loadHandler = {
    next: (configs: string[]): void => {
        if (configs.length > 0) {
            addPhotasaConfigFiles(paths.value, configs);
        }
    },
    complete: (configs: string[]): void => {
        processingFile.value = t("status.ready");
        if (configs.length > 0) {
            addPhotasaConfigFiles(paths.value, configs);
        }
    },
};

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
            startFileWatching(paths.value);
        } else {
            // Open preference to config
            showPreference.value = true;
        }
        return paths.value;
    })
    .then((configPaths) => {
        processingFile.value = t("status.loadingConfig");
        /* loadPhotasaConfigs([...configPaths], (action: string, configs: string[]) => {
            loadHandler[action]?.call(null, configs);
        });
 */
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
</script>

<template>
    <a-spin v-if="loading" />
    <a-layout v-else>
        <header class="app-header">
            <a-space class="title-header">
                <a-typography-text type="primary">{{ t("app.title") }}</a-typography-text>
            </a-space>
            <a-space class="setting-header">
                <CoffeeOutlined @click="openScanList"></CoffeeOutlined>
                <ImportOutlined @click="openImportPhotos"></ImportOutlined>
                <SettingOutlined @click="openPreference" />
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
                <a-typography-text type="success">{{ processingFile }}</a-typography-text>
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
        <Preference></Preference>
        <template #footer></template>
    </a-modal>
    <a-modal
        v-model:visible="showScanList"
        :mask-closable="false"
        :title="t('preference.settings')"
        width="800px"
    >
        <a-list size="small" bordered :data-source="scanningFolder" class="scan-list">
            <template #renderItem="{ item }">
                <a-list-item>{{ item.path }}</a-list-item>
            </template>
            <template #header>
                <a-spin></a-spin>
            </template>
            <template #footer></template>
        </a-list>
    </a-modal>
</template>

<style lang="less">
.content .image-content {
    height: calc(100vh - 70px);
    overflow-y: overlay;
    margin: auto;
}

.image-list {
    margin: 0;
    height: 100%;
}

.app-header {
    height: 36px;
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
</style>
