<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import { ref } from "vue";
import { storeToRefs } from "pinia";
import ImportPhotos from "./components/ImportPhotos.vue";
import SplitView from "./components/SplitView.vue";
import ImageList from "./components/ImageList.vue";
import FolderList from "./components/FolderList.vue";
import { usePhotosStore } from "@renderer/stores/photos";
import { startWatching, setupMenu } from "@renderer/utils/api";
import type { WatchState } from "src/preload/index.d";
import { deepCopy } from "./utils/object";
import Preference from "./components/Preference.vue";

const store = usePhotosStore();
const { paths } = storeToRefs(store);

const visible = ref(false);

startWatching(
    {
        paths: deepCopy(paths.value),
    },
    (state: WatchState) => {
        if (state.action === "add") {
            if (state.path && state.path.indexOf(".jpg") > 0) {
                store.addFile(state.path);
            }
        }
    },
);
setupMenu({
    onImportPhotos: () => {
        visible.value = true;
    },
    onPreference: () => {
        showPreference.value = true;
    },
});
const showPreference = ref(false);

function handleOk(): void {
    visible.value = false;
}

function handlePreferenceOk(): void {
    showPreference.value = false;
}
</script>

<template>
    <a-layout>
        <a-layout class="content">
            <split-view direction="horizontal" a-init="350px" a-min="200px" a-max="600px">
                <template #A>
                    <a-layout class="image-content">
                        <a-layout-content
                            :style="{
                                background: '#fff',
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
                                background: '#fff',
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
        <a-layout-footer>Footer</a-layout-footer>
    </a-layout>
    <a-modal v-model:visible="visible" :mask-closable="false" title="Basic Modal" @ok="handleOk">
        <ImportPhotos></ImportPhotos>
    </a-modal>
    <a-modal
        v-model:visible="showPreference"
        :mask-closable="false"
        title="Basic Modal"
        width="800px"
        @ok="handlePreferenceOk"
    >
        <Preference></Preference>
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
