<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import { ref, watch } from "vue";
import { storeToRefs } from "pinia";
import ImportPhotos from "./components/ImportPhotos.vue";
import SplitView from "./components/SplitView.vue";
import ImageList from "./components/ImageList.vue";
import FolderList from "./components/FolderList.vue";
import { usePhotosStore } from "@renderer/stores/photos";
import { usePreferenceStore } from "@renderer/stores/preference";
import {
    startWatching,
    setupMenu,
    getDirectory,
    stopWatching,
    loadPhotasaConfigs,
} from "@renderer/utils/api";
import { processScannedFileTask, scanPhotosTask, ScanArgs } from "@renderer/utils/scan-folder";
import { handleAddFileTask, handleDeleteFileTask } from "./utils/file-list";
import { deepCopy } from "./utils/object";
import Preference from "./components/Preference.vue";
import { useI18n } from "vue-i18n";
import type { PhotasaConfig, WatchState } from "src/preload/types";
import { watchArray } from "@vueuse/core";

const { t } = useI18n();
const photosStore = usePhotosStore();
const { processingFile } = storeToRefs(photosStore);
const { addPhotasaConfigFiles, addPhotasaConfigFile } = photosStore;
const preferenceStore = usePreferenceStore();
const { paths, darkMode, currentFolder, scanningFolder, thumbnailSize, scannedFolder } =
    storeToRefs(preferenceStore);
const { addPath, completeScanPath } = preferenceStore;

const visible = ref(false);
const showPreference = ref(false);
const loading = ref(false);
const loadingConfigs = ref(false);

function handlePreferenceOk(): void {
    showPreference.value = false;
}

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
        processScannedFileTask
            .perform(args, thumbnailSize.value)
            .then((photasa: { path: string; config: PhotasaConfig }) => {
                addPhotasaConfigFile(paths.value, {
                    path: photasa.path,
                    thumbnail: "",
                });
                processingFile.value = args.action?.path as string;
                runOverQueue();
            });
    } else {
        completeScanPath(scannedFolder.value);
    }
}

const scanningHandler: Record<string, (args: ScanArgs | undefined) => void> = {
    next: (args): void => {
        if (args?.action?.path) {
            queue.push(args);
            if (processScannedFileTask.isIdle) {
                runOverQueue();
            }
        }
    },
    error: (args): void => {
        if (args?.error?.message) {
            processingFile.value = args.error.message;
        }
    },
    complete: (args): void => {
        processingFile.value = t("status.scanned");
        if (args?.action?.path) {
            scannedFolder.value = args.action.path;
            processingFile.value = t("status.scanComplete", {
                path: args.action.path,
            });
        }
    },
};

function startScanning(): void {
    if (scanningFolder.value.length > 0) {
        scanPhotosTask.perform(scanningFolder.value[0], (args) => {
            scanningHandler[args.type]?.call(null, args);
        });
    }
}

watchArray(scanningFolder, startScanning, { deep: true });

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
        if (paths.value.find((p) => dir.indexOf(p) < 0)) {
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
    .then((configPaths: string[]) => {
        processingFile.value = t("status.loadingConfig");
        loadPhotasaConfigs([...configPaths], (action: string, configs: string[]) => {
            loadHandler[action]?.call(null, configs);
        });

        // Start to check if any leftover folder need to scan
        startScanning();
    });

setupMenu({
    onImportPhotos: () => {
        visible.value = true;
    },
    onPreference: () => {
        showPreference.value = true;
    },
});

// Update title
document.title = t("app.title");
</script>

<template>
    <a-spin v-if="loading" />
    <a-layout v-else>
        <a-layout class="content">
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
        <a-layout-footer>
            <a-space>
                <a-typography-text type="success">{{ processingFile }}</a-typography-text>
            </a-space>
        </a-layout-footer>
    </a-layout>

    <ImportPhotos v-model:show="visible"></ImportPhotos>

    <a-modal
        v-model:visible="showPreference"
        :mask-closable="false"
        :title="t('preference.settings')"
        width="800px"
        @ok="handlePreferenceOk">
        <Preference></Preference>
        <template #footer></template>
    </a-modal>
</template>

<style lang="scss">
.content .image-content {
    height: calc(100vh - 70px);
}

.image-list {
    margin: 0;
    height: 100%;
}
</style>
