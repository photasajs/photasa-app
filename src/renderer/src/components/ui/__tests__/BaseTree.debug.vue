<template>
    <div class="debug-container">
        <h3>BaseTree 调试信息</h3>

        <!-- 原始数据 -->
        <div class="debug-section">
            <h4>原始 TreeData:</h4>
            <pre>{{ JSON.stringify(treeData, null, 2) }}</pre>
        </div>

        <!-- 扁平化后的数据 -->
        <div class="debug-section">
            <h4>扁平化数据 (总计: {{ flatNodes.length }} 个):</h4>
            <div v-for="(node, index) in flatNodes" :key="index" class="flat-node">
                <span>{{ index }}: </span>
                <span>key="{{ node.key }}" </span>
                <span>title="{{ node.title }}" </span>
                <span>level={{ node.level }} </span>
                <span>visible={{ node.isVisible }}</span>
            </div>
        </div>

        <!-- 可见节点 -->
        <div class="debug-section">
            <h4>可见节点 (总计: {{ visibleNodes.length }} 个):</h4>
            <div v-for="(node, index) in visibleNodes" :key="index" class="visible-node">
                <span>{{ index }}: </span>
                <span>key="{{ node.key }}" </span>
                <span>title="{{ node.title }}" </span>
                <span>level={{ node.level }}</span>
            </div>
        </div>

        <!-- Key 重复检查 -->
        <div class="debug-section">
            <h4>Key 重复检查:</h4>
            <div v-for="[key, count] in duplicateKeys" :key="key" class="duplicate-key">
                <span style="color: red">重复 Key: "{{ key }}" - 出现 {{ count }} 次</span>
            </div>
            <div v-if="duplicateKeys.size === 0" style="color: green">✅ 没有发现重复的 Key</div>
        </div>

        <!-- 实际渲染的 BaseTree -->
        <div class="debug-section">
            <h4>实际渲染的 BaseTree:</h4>
            <BaseTree
                :tree-data="treeData"
                :virtual="virtual"
                :height="height"
                :item-height="28"
                v-model:expanded-keys="expandedKeys"
                v-model:selected-keys="selectedKeys"
            >
                <template #title="{ node, title }">
                    <span style="background: yellow">{{ title }} (key: {{ node.key }})</span>
                </template>
            </BaseTree>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import BaseTree from "../BaseTree.vue";
import type { TreeNode, Key } from "../BaseTree.vue";

interface Props {
    treeData: TreeNode[];
    virtual?: boolean;
    height?: number | string;
}

const props = withDefaults(defineProps<Props>(), {
    virtual: true,
    height: 400,
});

// 状态
const expandedKeys = ref<Key[]>([]);
const selectedKeys = ref<Key[]>([]);

// 从 BaseTree.vue 复制的扁平化逻辑
const expandedKeysSet = computed(() => new Set(expandedKeys.value));

const flattenTreeData = (
    nodes: TreeNode[],
    level = 0,
    parentExpanded = true,
): Array<{
    key: Key;
    title: string;
    level: number;
    isVisible: boolean;
    hasChildren: boolean;
    isExpanded: boolean;
    originalNode: TreeNode;
}> => {
    const result: Array<{
        key: Key;
        title: string;
        level: number;
        isVisible: boolean;
        hasChildren: boolean;
        isExpanded: boolean;
        originalNode: TreeNode;
    }> = [];

    for (const node of nodes) {
        const isExpanded = expandedKeysSet.value.has(node.key);
        const hasChildren = !!(node.children && node.children.length > 0) && !node.isLeaf;
        const isVisible = parentExpanded;

        // 添加当前节点
        result.push({
            key: node.key,
            title: node.title,
            level,
            isVisible,
            hasChildren,
            isExpanded,
            originalNode: node,
        });

        // 递归处理子节点
        if (hasChildren && isExpanded && node.children) {
            const childNodes = flattenTreeData(node.children, level + 1, isVisible && isExpanded);
            result.push(...childNodes);
        }
    }

    return result;
};

// 计算属性
const flatNodes = computed(() => {
    return flattenTreeData(props.treeData);
});

const visibleNodes = computed(() => {
    return flatNodes.value.filter((node) => node.isVisible);
});

// 检查重复的 key
const duplicateKeys = computed(() => {
    const keyCount = new Map<Key, number>();

    flatNodes.value.forEach((node) => {
        keyCount.set(node.key, (keyCount.get(node.key) || 0) + 1);
    });

    const duplicates = new Map<Key, number>();
    keyCount.forEach((count, key) => {
        if (count > 1) {
            duplicates.set(key, count);
        }
    });

    return duplicates;
});
</script>

<style scoped>
.debug-container {
    font-family: monospace;
    font-size: 12px;
    max-height: 80vh;
    overflow-y: auto;
    border: 1px solid #ccc;
    padding: 16px;
}

.debug-section {
    margin-bottom: 20px;
    border-bottom: 1px solid #eee;
    padding-bottom: 16px;
}

.debug-section h4 {
    margin: 0 0 8px 0;
    color: #333;
}

.flat-node,
.visible-node {
    font-size: 11px;
    margin: 2px 0;
    padding: 2px 4px;
    background: #f5f5f5;
}

.duplicate-key {
    font-weight: bold;
    margin: 2px 0;
}

pre {
    max-height: 200px;
    overflow: auto;
    background: #f8f8f8;
    padding: 8px;
    border: 1px solid #ddd;
}
</style>
