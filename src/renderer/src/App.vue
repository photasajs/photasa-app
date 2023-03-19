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
    setupMenu,
    getDirectory,
    stopWatching,
    loadPhotasaConfigs,
    getPhotasaConfigTask,
} from "@renderer/utils/api";
import { handleAddFileTask, handleDeleteFileTask } from "./utils/file-list";
import { deepCopy } from "./utils/object";
import Preference from "./components/Preference.vue";
import { useI18n } from "vue-i18n";
import type { PhotasaConfig, WatchState } from "src/preload/types";

const { t } = useI18n();
const photosStore = usePhotosStore();
const { processingFile } = storeToRefs(photosStore);
const { addFile } = photosStore;
const preferenceStore = usePreferenceStore();
const { paths, darkMode, currentFolder } = storeToRefs(preferenceStore);
const { addPath } = preferenceStore;
const visible = ref(false);
const msg = computed(() => {
    return {
        settings: t("preference.settings"),
    };
});
const showPreference = ref(false);
const loading = ref(false);

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
watch(
    paths,
    () => {
        // Stop current watching, then start a new one
        stopWatching().then(() => {
            startFileWatching(paths.value);
        });
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
        loadPhotasaConfigs([...configPaths], (action: string, config?: string) => {
            if (action === "next" && config) {
                getPhotasaConfigTask.perform(config).then((photasaConfig: PhotasaConfig) => {
                    photasaConfig.photoList.forEach((photo) => {
                        addFile(paths.value, {
                            path: photo.path,
                            thumbnail: photo.thumbnail,
                        });
                    });
                });
            }
            if (action === "complete") {
                processingFile.value = t("status.ready");
            }
        });
    });

setupMenu({
    onImportPhotos: () => {
        visible.value = true;
    },
    onPreference: () => {
        showPreference.value = true;
    },
});

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
                            <FolderList></FolderList>
                        </a-layout-content>
                    </a-layout>
                </template>

                <template #B>
                    <a-layout class="image-content">
                        <a-layout-content
                            :style="{
                                margin: 0,
                                minHeight: '280px',
                            }"
                        >
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
        :title="msg.settings"
        width="800px"
        @ok="handlePreferenceOk"
    >
        <Preference></Preference>
        <template #footer></template>
    </a-modal>
</template>

<style lang="less">
.content {
    height: calc(100vh - 70px);
}

#components-layout-demo-basic .code-box-demo {
    text-align: center;
}

#components-layout-demo-basic .ant-layout-header,
#components-layout-demo-basic .ant-layout-footer {
    color: #fff;
    background: #7dbcea;
}

[data-theme="dark"] #components-layout-demo-basic .ant-layout-header {
    background: #6aa0c7;
}

[data-theme="dark"] #components-layout-demo-basic .ant-layout-footer {
    background: #6aa0c7;
}

#components-layout-demo-basic .ant-layout-footer {
    line-height: 1.5;
}

#components-layout-demo-basic .ant-layout-sider {
    color: #fff;
    line-height: 120px;
    background: #3ba0e9;
}

[data-theme="dark"] #components-layout-demo-basic .ant-layout-sider {
    background: #3499ec;
}

#components-layout-demo-basic .ant-layout-content {
    min-height: 120px;
    color: #fff;
    line-height: 120px;
    background: rgba(16, 142, 233, 1);
}

[data-theme="dark"] #components-layout-demo-basic .ant-layout-content {
    background: #107bcb;
}

#components-layout-demo-basic > .code-box-demo > .ant-layout + .ant-layout {
    margin-top: 48px;
}
</style>
