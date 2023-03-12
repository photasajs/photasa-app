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
    createThumbnailTask,
    removeThumbnailTask,
} from "@renderer/utils/api";
import type { WatchState } from "src/preload/index.d";
import { deepCopy } from "./utils/object";
import Preference from "./components/Preference.vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const photosStore = usePhotosStore();
const { addFile, removeFile, removeFromFileList } = photosStore;
const { processingFile, currentFolder } = storeToRefs(photosStore);
const preferenceStore = usePreferenceStore();
const { paths, thumbnailSize, darkMode } = storeToRefs(preferenceStore);
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

function isMedia(state: WatchState): boolean {
    return state.isImage || state.isVideo;
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

watch(darkMode, () => {
    updateTheme();
});
watch(
    () => paths,
    () => {
        // Stop current watching, then start a new one
        stopWatching().then(() => {
            startFileWatching(paths.value);
        });
    },
);

function handleAddFile(state): void {
    // Directory skip hidden
    if (!state.isFile) {
        return;
    }

    const path = state.path ?? "";
    // Path is empty skip it.
    if (path.length <= 0) {
        return;
    }

    const parts = path.split("/");

    // Skip any thing start with dot
    const fileName = parts[parts.length - 1];
    if (fileName.startsWith(".") || parts.includes(".picasaoriginals")) {
        return;
    }

    if (isMedia(state)) {
        processingFile.value = state.path ?? "";

        createThumbnailTask
            .perform({
                path: state.path as string,
                thumbnail: state.thumbnail as string,
                width: thumbnailSize.value,
                height: thumbnailSize.value,
            })
            .then(() => {
                addFile(paths.value, {
                    path: state.path as string,
                    thumbnail: state.thumbnail,
                });
            });
    }
}

function handleDeleteFile(state): void {
    // Directory skip hidden
    if (!state.isFile) {
        return;
    }

    if (isMedia(state)) {
        removeThumbnailTask.perform({
            path: state.path as string,
            thumbnail: state.thumbnail,
            width: thumbnailSize.value,
            height: thumbnailSize.value,
        });

        removeFile(paths.value, {
            path: state.path as string,
            thumbnail: state.thumbnail,
        });

        removeFromFileList({
            path: state.path as string,
            thumbnail: state.thumbnail,
        });
    }
}

const actions = {
    add: handleAddFile,
    delete: handleDeleteFile,
};

function startFileWatching(dirs): void {
    // start watching folders
    startWatching(
        {
            paths: deepCopy(dirs),
        },
        (state: WatchState) => {
            const handler = actions[state.action ?? ""];
            handler?.apply(null, [state]);
        },
    );
}

getDirectory("desktop").then((dir) => {
    currentFolder.value = paths.value[0];
    if (paths.value.length > 0) {
        startFileWatching(paths.value);
    }

    // Desktop directory is ready
    if (paths.value.find((p) => dir.indexOf(p) < 0)) {
        addPath(dir);
    }

    loading.value = false;
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
                        <a-layout-content
                            :style="{
                                margin: 0,
                                padding: '24px 0 0 0',
                                minHeight: '280px',
                            }"
                        >
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
        <a-layout-footer>{{ processingFile }}</a-layout-footer>
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
