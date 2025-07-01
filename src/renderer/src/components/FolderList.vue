<script setup lang="ts">
import { ref, watch, reactive } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import type { PhotasaConfig } from "src/preload/types";
import {
    fixPhotasaConfig,
    getPhotasaConfig,
    openInFinder,
    resetPhotasaConfig,
} from "@renderer/utils/api";
import { JsonTreeView } from "json-tree-view-vue3";
import { trim, isEmpty } from "radash";

const { t } = useI18n();

const preferenceStore = usePreferenceStore();
const { addScanFolder } = preferenceStore;
const { paths, currentFolder, currentFolderConfig, folderTree } = storeToRefs(preferenceStore);

const expandedKeys = ref<string[]>([...paths.value]);
const selectedKeys = ref<string[]>([currentFolder.value]);
const showConfigModal = ref(false);

watch(
    selectedKeys,
    () => {
        // Only when Current folder changed, update current folder and reset photasa config
        if (!isEmpty(selectedKeys.value) && currentFolder.value !== selectedKeys.value[0]) {
            currentFolderConfig.value = {
                version: "",
                photoList: [],
                lastModified: 0,
            } satisfies PhotasaConfig;
            currentFolder.value = selectedKeys.value[0];
        }
    },
    { deep: true },
);

const loadingInfo = ref(false);
const photasa = reactive<{
    config: string;
    path: string;
    maxDepth: number;
}>({
    config: "{}",
    path: "",
    maxDepth: 0,
});

/**
 * Open photasa config modal
 * @param folder - The folder to open the config modal for
 */
async function openPhotasaConfig(folder: string): Promise<void> {
    loadingInfo.value = true;
    showConfigModal.value = true;
    const config = await getPhotasaConfig(folder);

    photasa.config = JSON.stringify(config);
    photasa.path = folder;
    loadingInfo.value = false;
}

function openFileInFinder(key: string): void {
    const path = `/${trim(key, "file://")}`;
    openInFinder(path);
}

async function fixConfig(): Promise<void> {
    const config = await fixPhotasaConfig(photasa.path);
    photasa.config = JSON.stringify(config);
}

async function rescan(key: string): Promise<void> {
    await resetPhotasaConfig(key);
    addScanFolder(key, "rescan");
}
</script>

<template>
    <div
        class="flex flex-col h-full min-h-0 bg-white rounded-lg shadow border border-gray-200 folder-list-card"
    >
        <div class="px-4 py-2 border-b border-gray-100 flex items-center">
            <a-breadcrumb class="folder-list-header">
                <a-breadcrumb-item>{{ t("app.folderList") }}</a-breadcrumb-item>
            </a-breadcrumb>
        </div>
        <a-tree
            class="flex-1 min-h-0 overflow-auto"
            v-model:expandedKeys="expandedKeys"
            v-model:selectedKeys="selectedKeys"
            :tree-data="folderTree"
        >
            <template #title="{ title, key }">
                <a-dropdown :trigger="['contextmenu']">
                    <span v-if="paths.includes(key)" class="root-folder-node">{{ title }}</span>
                    <template v-else>
                        <span class="folder-node">{{ title }}</span>
                    </template>
                    <template #overlay>
                        <a-menu>
                            <a-menu-item key="2" @click="rescan(key)">{{
                                t("menu.rescan")
                            }}</a-menu-item>
                            <a-menu-item key="1" @click="openPhotasaConfig(key)">{{
                                t("menu.getConfig")
                            }}</a-menu-item>
                            <a-menu-item key="2" @click="openFileInFinder(key)">{{
                                t("menu.open")
                            }}</a-menu-item>
                        </a-menu>
                    </template>
                </a-dropdown>
            </template>
        </a-tree>
    </div>
    <a-modal v-model:visible="showConfigModal" title="">
        <a-spin :spinning="loadingInfo">
            <a-descriptions title="Image Info" layout="vertical" bordered :column="2">
                <a-descriptions-item label="Location" :span="2">{{
                    photasa.path
                }}</a-descriptions-item>
                <a-descriptions-item label="Status" :span="2">
                    <a-layout
                        :style="{
                            height: '100%',
                            width: '265px',
                            overflow: 'auto',
                        }"
                    >
                        <JsonTreeView :data="photasa.config" :max-depth="photasa.maxDepth" />
                    </a-layout>
                </a-descriptions-item>
            </a-descriptions>
        </a-spin>
        <template #footer>
            <a-button @click="fixConfig()">
                {{ t("button.fixConfig") }}
            </a-button>
        </template>
    </a-modal>
</template>
<style lang="scss">
.root-folder-node {
    color: #1890ff;
}

.folder-node {
    white-space: nowrap;
}

.root-folder-node {
    white-space: nowrap;
}

.folder-list-header {
    height: 32px;
    line-height: 32px;
}

.folder-list-card {
    height: calc(100vh - var(--photasa-footer-height));
    overflow: auto;
}
</style>
