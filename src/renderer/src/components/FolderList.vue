<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { DataNode } from "ant-design-vue/es/tree";
import { usePhotosStore } from "@renderer/stores/photos";
import { usePreferenceStore } from "@renderer/stores/preference";
import { buildDataNode } from "@renderer/utils/folder-tree";

const photosStore = usePhotosStore();
const preferenceStore = usePreferenceStore();

const expandedKeys = ref<string[]>(photosStore.paths);
const selectedKeys = ref<string[]>(photosStore.paths);
const checkedKeys = ref<string[]>([]);

const treeData = computed((): DataNode[] => {
    const roots: DataNode[] = [];
    preferenceStore.paths.forEach((path) => {
        roots.push({
            title: path,
            key: path,
            children: [],
        });

        photosStore.files.get(path)?.forEach((file) => {
            buildDataNode(roots, file);
        });
    });
    return roots;
});

watch(expandedKeys, () => {
    console.log("expandedKeys", expandedKeys);
});
watch(selectedKeys, () => {
    console.log("selectedKeys", selectedKeys);
});
watch(checkedKeys, () => {
    console.log("checkedKeys", checkedKeys);
});
</script>

<template>
    <a-tree
        v-model:expandedKeys="expandedKeys"
        v-model:selectedKeys="selectedKeys"
        v-model:checkedKeys="checkedKeys"
        checkable
        :tree-data="treeData"
    >
        <template #title="{ title, key }">
            <span v-if="key === '0-0-1-0'" style="color: #1890ff">{{ title }}</span>
            <template v-else>{{ title }}</template>
        </template>
    </a-tree>
</template>
