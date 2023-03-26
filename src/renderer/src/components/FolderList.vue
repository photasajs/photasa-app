<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { DataNode } from "ant-design-vue/es/tree";
import { usePhotosStore } from "@renderer/stores/photos";
import { usePreferenceStore } from "@renderer/stores/preference";
import { buildDataNode } from "@renderer/utils/folder-tree";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import type { PhotasaConfig } from "src/preload/types";

const { t } = useI18n();
const photosStore = usePhotosStore();
const { files } = storeToRefs(photosStore);

const preferenceStore = usePreferenceStore();

const { paths, currentFolder, currentFolderConfig } = storeToRefs(preferenceStore);
const { updateFileList, getFolderFiles } = photosStore;

const expandedKeys = ref<string[]>([...paths.value]);
const selectedKeys = ref<string[]>([currentFolder.value]);

const treeData = computed((): DataNode[] => {
    const roots: DataNode[] = [];
    paths.value.forEach((path) => {
        roots.push({
            title: path,
            key: path,
            children: [],
        });

        files.value.get(path)?.forEach((file) => {
            buildDataNode(roots, file, {
                updateFileList,
                getFolderFiles,
            });
        });
    });
    return roots;
});

watch(selectedKeys, () => {
    if (currentFolder.value !== selectedKeys.value[0]) {
        // Current folder changed, update current folder and reset photasa config
        currentFolder.value = selectedKeys.value[0];
        currentFolderConfig.value = <PhotasaConfig>{};
    }
});
</script>

<template>
    <a-card>
        <template #title>
            <a-breadcrumb style="margin: 16px 0">
                <a-breadcrumb-item>{{ t("app.folderList") }}</a-breadcrumb-item>
            </a-breadcrumb>
        </template>
        <a-tree v-model:expandedKeys="expandedKeys" v-model:selectedKeys="selectedKeys" :tree-data="treeData">
            <template #title="{ title, key }">
                <span v-if="paths.includes(key)" class="root-folder-node">{{ title }}</span>
                <template v-else>
                    <a-dropdown :trigger="['contextmenu']">

                        <span class="folder-node">{{ title }}</span>

                        <template #overlay>
                            <a-menu>
                                <a-menu-item key="1">{{
                                    t("menu.getInfo")
                                }}</a-menu-item>
                                <a-menu-item key="2">{{
                                    t("menu.open")
                                }}</a-menu-item>
                            </a-menu>
                        </template>
                    </a-dropdown>

                </template>
            </template>
        </a-tree>
    </a-card>
</template>
<style lang="scss">
.root-folder-node {
    color: #1890ff
}

.folder-node {
    white-space: nowrap;
}
</style>
