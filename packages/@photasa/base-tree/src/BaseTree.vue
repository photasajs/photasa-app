<template>
    <div
        ref="containerRef"
        class="base-tree scrollbar-theme"
        :class="{
            'base-tree--virtual': virtual,
            'base-tree--show-line': showLine,
            'base-tree--disabled': disabled,
        }"
    >
        <template v-if="virtual">
            <VirtualList
                ref="virtualListRef"
                :items="uniqueVisibleNodes"
                :item-height="itemHeight"
                :container-height="actualHeight"
                :get-item-key="(item: VirtualTreeNode) => String(item.key)"
                class="base-tree__virtual-list"
            >
                <template #default="{ item }">
                    <BaseTreeNode
                        :key="item.key"
                        :node="item.originalNode"
                        :level="item.level"
                        :is-expanded="expandedKeysSet.has(item.key)"
                        :is-selected="selectedKeysSet.has(item.key)"
                        :is-checked="checkedKeysSet.has(item.key)"
                        :is-half-checked="halfCheckedKeysSet.has(item.key)"
                        :checkable="checkable"
                        :selectable="selectable"
                        :show-icon="showIcon"
                        :show-line="showLine"
                        :disabled="disabled || item.originalNode.disabled"
                        :block-node="blockNode"
                        :virtual="true"
                        @expand="handleNodeExpand"
                        @select="handleNodeSelect"
                        @check="handleNodeCheck"
                        @click="handleNodeClick"
                        @dblclick="handleNodeDblclick"
                        @contextmenu="handleNodeContextmenu"
                    >
                        <template v-if="$slots.title" #title="slotProps">
                            <slot name="title" v-bind="slotProps" />
                        </template>
                        <template v-if="$slots.icon" #icon="slotProps">
                            <slot name="icon" v-bind="slotProps" />
                        </template>
                        <template v-if="$slots.switcherIcon" #switcherIcon="slotProps">
                            <slot name="switcherIcon" v-bind="slotProps" />
                        </template>
                    </BaseTreeNode>
                </template>
            </VirtualList>
        </template>

        <template v-else>
            <BaseTreeNode
                v-for="node in treeData"
                :key="node.key"
                :node="node"
                :level="0"
                :is-expanded="expandedKeysSet.has(node.key)"
                :is-selected="selectedKeysSet.has(node.key)"
                :is-checked="checkedKeysSet.has(node.key)"
                :is-half-checked="halfCheckedKeysSet.has(node.key)"
                :checkable="checkable"
                :selectable="selectable"
                :show-icon="showIcon"
                :show-line="showLine"
                :disabled="disabled || node.disabled"
                :block-node="blockNode"
                :expanded-keys-set="expandedKeysSet"
                :selected-keys-set="selectedKeysSet"
                :checked-keys-set="checkedKeysSet"
                :half-checked-keys-set="halfCheckedKeysSet"
                :virtual="false"
                @expand="handleNodeExpand"
                @select="handleNodeSelect"
                @check="handleNodeCheck"
                @click="handleNodeClick"
                @dblclick="handleNodeDblclick"
                @contextmenu="handleNodeContextmenu"
            >
                <template v-if="$slots.title" #title="slotProps">
                    <slot name="title" v-bind="slotProps" />
                </template>
                <template v-if="$slots.icon" #icon="slotProps">
                    <slot name="icon" v-bind="slotProps" />
                </template>
                <template v-if="$slots.switcherIcon" #switcherIcon="slotProps">
                    <slot name="switcherIcon" v-bind="slotProps" />
                </template>
            </BaseTreeNode>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import type { Ref } from "vue";
import BaseTreeNode from "./BaseTreeNode.vue";
import VirtualList from "./internal/VirtualList.vue";
import {
    dedupeVisibleNodes,
    extractAllTreeKeys,
    findTreeNode,
    flattenVisibleTreeNodes,
} from "./flatten-visible";
import { isElementInScrollContainer } from "./tree-scroll";
import type {
    CheckInfo,
    CheckedKeys,
    ExpandInfo,
    Key,
    SelectInfo,
    TreeNode,
    VirtualTreeNode,
} from "./types";

export type { Key, TreeNode } from "./types";

interface Props {
    treeData?: TreeNode[];
    expandedKeys?: Key[];
    selectedKeys?: Key[];
    checkedKeys?: Key[] | CheckedKeys;
    multiple?: boolean;
    checkable?: boolean;
    selectable?: boolean;
    showIcon?: boolean;
    showLine?: boolean;
    disabled?: boolean;
    blockNode?: boolean;
    draggable?: boolean;
    defaultExpandAll?: boolean;
    defaultExpandParent?: boolean;
    autoExpandParent?: boolean;
    defaultExpandedKeys?: Key[];
    defaultSelectedKeys?: Key[];
    defaultCheckedKeys?: Key[] | CheckedKeys;
    virtual?: boolean;
    height?: number | string;
    itemHeight?: number;
    checkStrictly?: boolean;
    loadData?: (node: TreeNode) => Promise<void>;
    loadedKeys?: Key[];
    autoFocusOnExpand?: boolean;
    replaceFields?: Record<string, string>;
    fieldNames?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
    treeData: () => [],
    expandedKeys: () => [],
    selectedKeys: () => [],
    checkedKeys: () => [],
    multiple: false,
    checkable: false,
    selectable: true,
    showIcon: true,
    showLine: false,
    disabled: false,
    blockNode: false,
    draggable: false,
    defaultExpandAll: false,
    defaultExpandParent: true,
    autoExpandParent: true,
    defaultExpandedKeys: () => [],
    defaultSelectedKeys: () => [],
    defaultCheckedKeys: () => [],
    virtual: false,
    height: "100%",
    itemHeight: 28,
    checkStrictly: false,
    loadedKeys: () => [],
    autoFocusOnExpand: false,
});

const emit = defineEmits<{
    "update:expandedKeys": [keys: Key[]];
    "update:selectedKeys": [keys: Key[]];
    "update:checkedKeys": [keys: Key[] | CheckedKeys];
    expand: [keys: Key[], info: ExpandInfo];
    select: [keys: Key[], info: SelectInfo];
    check: [keys: Key[] | CheckedKeys, info: CheckInfo];
    click: [info: { event: Event; node: TreeNode }];
    dblclick: [info: { event: Event; node: TreeNode }];
    rightClick: [info: { event: Event; node: TreeNode }];
    contextmenu: [info: { event: Event; node: TreeNode }];
    load: [loadedKeys: Key[], info: { event: "load"; node: TreeNode }];
    dragStart: [info: { event: DragEvent; node: TreeNode }];
    dragEnter: [info: { event: DragEvent; node: TreeNode; expandedKeys: Key[] }];
    dragOver: [info: { event: DragEvent; node: TreeNode }];
    dragLeave: [info: { event: DragEvent; node: TreeNode }];
    dragEnd: [info: { event: DragEvent; node: TreeNode }];
    drop: [
        info: {
            event: DragEvent;
            node: TreeNode;
            dragNode: TreeNode;
            dragNodesKeys: Key[];
            dropPosition: number;
            dropToGap: boolean;
        },
    ];
}>();

const internalExpandedKeys: Ref<Key[]> = ref([]);
const internalSelectedKeys: Ref<Key[]> = ref([]);
const internalCheckedKeys: Ref<Key[]> = ref([]);
const internalHalfCheckedKeys: Ref<Key[]> = ref([]);

const containerRef = ref<HTMLElement>();
const virtualListRef = ref<InstanceType<typeof VirtualList>>();
const computedHeight = ref<number>(200);

const currentExpandedKeys = computed(() =>
    props.expandedKeys.length > 0 ? props.expandedKeys : internalExpandedKeys.value,
);

const currentSelectedKeys = computed(() =>
    props.selectedKeys?.length > 0 ? props.selectedKeys : internalSelectedKeys.value,
);

const currentCheckedKeys = computed(() => {
    if (Array.isArray(props.checkedKeys)) {
        return props.checkedKeys.length > 0 ? props.checkedKeys : internalCheckedKeys.value;
    }
    if (props.checkedKeys.checked) {
        return props.checkedKeys.checked;
    }
    return internalCheckedKeys.value;
});

const currentHalfCheckedKeys = computed(() => {
    if (!Array.isArray(props.checkedKeys) && props.checkedKeys.halfChecked) {
        return props.checkedKeys.halfChecked;
    }
    return internalHalfCheckedKeys.value;
});

const expandedKeysSet = computed(() => new Set(currentExpandedKeys.value));
const selectedKeysSet = computed(() => new Set(currentSelectedKeys.value));
const checkedKeysSet = computed(() => new Set(currentCheckedKeys.value));
const halfCheckedKeysSet = computed(() => new Set(currentHalfCheckedKeys.value));

const actualHeight = computed(() => {
    if (typeof props.height === "number") {
        return props.height;
    }
    return computedHeight.value;
});

const uniqueVisibleNodes = computed(() =>
    dedupeVisibleNodes(flattenVisibleTreeNodes(props.treeData, expandedKeysSet.value)),
);

const initializeDefaults = () => {
    if (props.defaultExpandAll) {
        internalExpandedKeys.value = extractAllTreeKeys(props.treeData);
    } else if (props.defaultExpandedKeys.length > 0) {
        internalExpandedKeys.value = [...props.defaultExpandedKeys];
    }

    if (props.defaultSelectedKeys.length > 0) {
        internalSelectedKeys.value = [...props.defaultSelectedKeys];
    }

    if (Array.isArray(props.defaultCheckedKeys)) {
        internalCheckedKeys.value = [...props.defaultCheckedKeys];
    } else if (props.defaultCheckedKeys.checked) {
        internalCheckedKeys.value = [...props.defaultCheckedKeys.checked];
        if (props.defaultCheckedKeys.halfChecked) {
            internalHalfCheckedKeys.value = [...props.defaultCheckedKeys.halfChecked];
        }
    }
};

const scrollToNode = (
    nodeKey: Key,
    options?: { align?: "start" | "center" | "end" | "auto"; behavior?: "auto" | "smooth" },
) => {
    if (!containerRef.value) {
        return;
    }

    if (props.virtual) {
        const flatNodes = flattenVisibleTreeNodes(props.treeData, expandedKeysSet.value);
        const nodeIndex = flatNodes.findIndex((item) => item.key === nodeKey);

        if (nodeIndex >= 0 && virtualListRef.value) {
            if (virtualListRef.value.isIndexVisible(nodeIndex)) {
                return;
            }
            virtualListRef.value.scrollToIndex(nodeIndex, options);
        }
        return;
    }

    const nodeElement = containerRef.value.querySelector(`[data-node-key="${nodeKey}"]`);
    if (nodeElement) {
        if (isElementInScrollContainer(nodeElement, containerRef.value)) {
            return;
        }
        nodeElement.scrollIntoView({
            behavior: options?.behavior || "smooth",
            block: (options?.align as ScrollLogicalPosition) || "center",
            inline: "nearest",
        });
    }
};

const captureVirtualScrollBeforeMutation = (): void => {
    if (props.virtual) {
        virtualListRef.value?.captureScrollOffset();
    }
};

const handleNodeExpand = (node: TreeNode, expanded?: boolean) => {
    captureVirtualScrollBeforeMutation();

    const newExpanded = expanded !== undefined ? expanded : !expandedKeysSet.value.has(node.key);
    const newExpandedKeys = newExpanded
        ? [...currentExpandedKeys.value, node.key]
        : currentExpandedKeys.value.filter((key) => key !== node.key);

    internalExpandedKeys.value = newExpandedKeys;
    emit("update:expandedKeys", newExpandedKeys);
    emit("expand", newExpandedKeys, {
        node,
        expanded: newExpanded,
        nativeEvent: new Event("expand"),
    });

    if (props.autoFocusOnExpand && newExpanded) {
        nextTick(() => {
            scrollToNode(node.key, { align: "center", behavior: "smooth" });
        });
    }
};

const handleNodeSelect = (node: TreeNode, selected?: boolean, event?: Event) => {
    const newSelected = selected !== undefined ? selected : !selectedKeysSet.value.has(node.key);
    const newSelectedKeys = props.multiple
        ? newSelected
            ? [...currentSelectedKeys.value, node.key]
            : currentSelectedKeys.value.filter((key) => key !== node.key)
        : newSelected
          ? [node.key]
          : [];

    internalSelectedKeys.value = newSelectedKeys;
    emit("update:selectedKeys", newSelectedKeys);
    emit("select", newSelectedKeys, {
        event: "select",
        selected: newSelected,
        node,
        selectedNodes: newSelectedKeys
            .map((key) => findTreeNode(key, props.treeData))
            .filter(Boolean) as TreeNode[],
        nativeEvent: event || new Event("select"),
    });
};

const handleNodeCheck = (node: TreeNode, checked?: boolean, event?: Event) => {
    const newChecked = checked !== undefined ? checked : !checkedKeysSet.value.has(node.key);
    const newCheckedKeys = newChecked
        ? [...currentCheckedKeys.value, node.key]
        : currentCheckedKeys.value.filter((key) => key !== node.key);
    const newHalfCheckedKeys: Key[] = [...currentHalfCheckedKeys.value];

    internalCheckedKeys.value = newCheckedKeys;
    internalHalfCheckedKeys.value = newHalfCheckedKeys;

    const checkedKeysResult = props.checkStrictly
        ? newCheckedKeys
        : {
              checked: newCheckedKeys,
              halfChecked: newHalfCheckedKeys,
          };

    emit("update:checkedKeys", checkedKeysResult);
    emit("check", checkedKeysResult, {
        event: "check",
        node,
        checked: newChecked,
        nativeEvent: event || new Event("check"),
        checkedNodes: newCheckedKeys
            .map((key) => findTreeNode(key, props.treeData))
            .filter(Boolean) as TreeNode[],
        halfCheckedKeys: newHalfCheckedKeys,
    });
};

const handleNodeClick = (node: TreeNode, event: Event) => {
    emit("click", { event, node });
};

const handleNodeDblclick = (node: TreeNode, event: Event) => {
    emit("dblclick", { event, node });
};

const handleNodeContextmenu = (node: TreeNode, event: Event) => {
    emit("contextmenu", { event, node });
    emit("rightClick", { event, node });
};

const updateHeight = () => {
    if (typeof props.height === "string" && containerRef.value) {
        const rect = containerRef.value.getBoundingClientRect();
        computedHeight.value = rect.height || 200;
    }
};

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    initializeDefaults();

    if (typeof props.height === "string") {
        nextTick(() => {
            updateHeight();
        });

        if (containerRef.value && window.ResizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                updateHeight();
            });
            resizeObserver.observe(containerRef.value);
        }
    }
});

onUnmounted(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
});

watch(
    () => props.treeData,
    () => {
        if (props.defaultExpandAll) {
            const allKeys = extractAllTreeKeys(props.treeData);
            internalExpandedKeys.value = allKeys;
            emit("update:expandedKeys", allKeys);
        }
    },
    { deep: true, flush: "post" },
);

// 父组件直接改 expandedKeys（非点击展开）时，在列表重算前捕获滚动
watch(
    () => props.expandedKeys.length,
    (newLength, oldLength) => {
        if (!props.virtual || oldLength === undefined || newLength === oldLength) {
            return;
        }
        captureVirtualScrollBeforeMutation();
    },
    { flush: "sync" },
);

defineExpose({
    scrollToNode,
});
</script>

<style scoped>
.base-tree {
    color: var(--color-text, #000000d9);
    font-size: 14px;
    line-height: 1.5715;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.base-tree--disabled {
    color: var(--color-text-disabled, #00000040);
}

.base-tree__virtual-list {
    width: 100%;
    flex: 1;
}

.base-tree--virtual {
    overflow: hidden;
    min-height: 0;
    flex: 1;
}

.base-tree--show-line .base-tree-node {
    position: relative;
}

.base-tree--show-line .base-tree-node::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 50%;
    left: calc(var(--tree-level, 0) * 20px + 10px);
    border-left: 1px solid var(--color-border, #d9d9d9);
}

.base-tree--show-line .base-tree-node::after {
    content: "";
    position: absolute;
    top: 50%;
    left: calc(var(--tree-level, 0) * 20px + 10px);
    width: 10px;
    border-top: 1px solid var(--color-border, #d9d9d9);
}

.base-tree--show-line .base-tree-node:last-child::before {
    bottom: 50%;
}
</style>
