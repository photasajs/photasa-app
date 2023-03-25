<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { DataNode } from "ant-design-vue/es/tree";
import { usePhotosStore } from "@renderer/stores/photos";
import { usePreferenceStore } from "@renderer/stores/preference";
import { buildDataNode } from "@renderer/utils/folder-tree";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const photosStore = usePhotosStore();
const preferenceStore = usePreferenceStore();
const { files } = storeToRefs(photosStore);
const { paths, currentFolder } = storeToRefs(preferenceStore);
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
    currentFolder.value = selectedKeys.value[0];
});
</script>

<template>
    <a-card>
        <template #title>
            <a-breadcrumb style="margin: 16px 0">
                <a-breadcrumb-item>{{ t("app.folderList") }}</a-breadcrumb-item>
            </a-breadcrumb>
        </template>
        <a-tree
            v-model:expandedKeys="expandedKeys"
            v-model:selectedKeys="selectedKeys"
            :tree-data="treeData"
        >
            <template #title="{ title, key }">
                <span v-if="paths.includes(key)" style="color: #1890ff">{{ title }}</span>
                <template v-else>{{ title }}</template>
            </template>
        </a-tree>
    </a-card>
</template>
