<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import SplitView from "./components/SplitView.vue";
import FolderList from "./components/FolderList.vue";
import { photosStore } from "@renderer/stores/photos";

const store = photosStore();
const { ipcRenderer } = window.electron;
// Start file watching
ipcRenderer?.send("picasa:start-file-watch", {
    paths: JSON.parse(JSON.stringify(store.paths)),
});

// Response to event then save to pinia store
ipcRenderer?.on("picasa:file-add", (_, { isFile, path }) => {
    console.log("picasa:file-add", isFile, path);
    if (path.indexOf(".jpeg") > 0) {
        store.addFile(path);
    }
});
ipcRenderer?.on("picasa:file-change", (_, { isFile, path }) => {
    console.log("picasa:file-change", isFile, path);
});
ipcRenderer?.on("picasa:file-unlink", (_, { isFile, path }) => {
    console.log("picasa:file-unlink", isFile, path);
});
ipcRenderer?.on("picasa:file-error", (_, { error }) => {
    console.log("picasa:file-error", error);
});
ipcRenderer?.on("picasa:file-ready", () => {
    console.log("picasa:file-ready");
});
ipcRenderer?.on("picasa:file-raw", (_, { isFile, path }) => {
    console.log("picasa:file-raw", isFile, path);
});
</script>

<template>
    <a-layout>
        <a-layout-header class="header">
            <a-dropdown>
                <a class="ant-dropdown-link" @click.prevent>
                    Hover me
                    <DownOutlined />
                </a>
                <template #overlay>
                    <a-menu>
                        <a-menu-item>
                            <a href="javascript:;">1st menu item</a>
                        </a-menu-item>
                        <a-menu-item>
                            <a href="javascript:;">2nd menu item</a>
                        </a-menu-item>
                        <a-menu-item>
                            <a href="javascript:;">3rd menu item</a>
                        </a-menu-item>
                    </a-menu>
                </template>
            </a-dropdown>
        </a-layout-header>
        <a-layout>
            <split-view direction="horizontal" a-init="350px" a-min="200px" a-max="600px">
                <template #A>
                    <FolderList></FolderList>
                </template>

                <template #B>
                    <a-layout style="padding: 0 24px 24px">
                        <a-breadcrumb style="margin: 16px 0">
                            <a-breadcrumb-item>Home</a-breadcrumb-item>
                            <a-breadcrumb-item>List</a-breadcrumb-item>
                            <a-breadcrumb-item>App</a-breadcrumb-item>
                        </a-breadcrumb>
                        <a-layout-content
                            :style="{
                                background: '#fff',
                                padding: '24px',
                                margin: 0,
                                minHeight: '280px',
                            }"
                        >
                            Content
                        </a-layout-content>
                    </a-layout>
                </template>
            </split-view>
        </a-layout>
        <a-layout-footer>Footer</a-layout-footer>
    </a-layout>
</template>

<style lang="less">
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
