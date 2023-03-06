<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { DataNode } from "ant-design-vue/es/tree";
import { usePhotosStore } from "@renderer/stores/photos";
import { usePreferenceStore } from "@renderer/stores/preference";
import { buildDataNode } from "@renderer/utils/folder-tree";
import { storeToRefs } from "pinia";

const photosStore = usePhotosStore();
const preferenceStore = usePreferenceStore();
const { files } = storeToRefs(photosStore);
const { paths } = storeToRefs(preferenceStore);

const expandedKeys = ref<string[]>([preferenceStore.paths[0]]);
const selectedKeys = ref<string[]>([preferenceStore.paths[0]]);

const treeData = computed((): DataNode[] => {
    const roots: DataNode[] = [];
    paths.value.forEach((path) => {
        roots.push({
            title: path,
            key: path,
            children: [],
        });

        files.value.get(path)?.forEach((file) => {
            buildDataNode(roots, file);
        });
    });
    return roots;
});

watch(selectedKeys, () => {
    console.log("selectedKeys", selectedKeys);
    photosStore.setCurrentFolder(selectedKeys.value[0]);
});
</script>

<template>
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
</template>
