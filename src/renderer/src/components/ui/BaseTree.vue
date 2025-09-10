<template>
    <div
        ref="containerRef"
        class="base-tree"
        :class="{
            'base-tree--virtual': virtual,
            'base-tree--show-line': showLine,
            'base-tree--disabled': disabled,
        }"
    >
        <!-- 虚拟化渲染 -->
        <template v-if="virtual">
            <VirtualList
                :items="uniqueVisibleNodes"
                :item-height="itemHeight"
                :container-height="actualHeight"
                :get-item-key="(item: VirtualTreeNode, index: number) => `${item.key}-${index}`"
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
                        <!-- 插槽转发 -->
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

        <!-- 非虚拟化递归渲染 -->
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
                <!-- 插槽转发 -->
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
import VirtualList from "./VirtualList.vue";

// 类型定义
export type Key = string | number;

export interface TreeNode {
    key: Key;
    title: string;
    children?: TreeNode[];
    isLeaf?: boolean;
    disabled?: boolean;
    selectable?: boolean;
    checkable?: boolean;
    disableCheckbox?: boolean;
    icon?: any;
    [key: string]: any;
}

interface VirtualTreeNode {
    key: Key;
    title: string;
    level: number;
    isVisible: boolean;
    hasChildren: boolean;
    isExpanded: boolean;
    originalNode: TreeNode;
}

interface CheckedKeys {
    checked: Key[];
    halfChecked: Key[];
}

interface ExpandInfo {
    node: TreeNode;
    expanded: boolean;
    nativeEvent: Event;
}

interface SelectInfo {
    event: "select";
    selected: boolean;
    node: TreeNode;
    selectedNodes: TreeNode[];
    nativeEvent: Event;
}

interface CheckInfo {
    event: "check";
    node: TreeNode;
    checked: boolean;
    nativeEvent: Event;
    checkedNodes: TreeNode[];
    checkedNodesPositions?: any[];
    halfCheckedKeys: Key[];
}

// Props 定义
interface Props {
    // 数据相关
    treeData?: TreeNode[];

    // v-model 绑定
    expandedKeys?: Key[];
    selectedKeys?: Key[];
    checkedKeys?: Key[] | CheckedKeys;

    // 行为控制
    multiple?: boolean;
    checkable?: boolean;
    selectable?: boolean;
    showIcon?: boolean;
    showLine?: boolean;
    disabled?: boolean;
    blockNode?: boolean;
    draggable?: boolean;

    // 默认状态
    defaultExpandAll?: boolean;
    defaultExpandParent?: boolean;
    autoExpandParent?: boolean;
    defaultExpandedKeys?: Key[];
    defaultSelectedKeys?: Key[];
    defaultCheckedKeys?: Key[] | CheckedKeys;

    // 虚拟化
    virtual?: boolean;
    height?: number | string;
    itemHeight?: number;

    // 高级功能
    checkStrictly?: boolean;
    loadData?: (node: TreeNode) => Promise<void>;
    loadedKeys?: Key[];
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
});

// Emits 定义
const emit = defineEmits<{
    // v-model 更新
    "update:expandedKeys": [keys: Key[]];
    "update:selectedKeys": [keys: Key[]];
    "update:checkedKeys": [keys: Key[] | CheckedKeys];

    // 用户交互事件
    expand: [keys: Key[], info: ExpandInfo];
    select: [keys: Key[], info: SelectInfo];
    check: [keys: Key[] | CheckedKeys, info: CheckInfo];

    // 节点事件
    click: [info: { event: Event; node: TreeNode }];
    dblclick: [info: { event: Event; node: TreeNode }];
    rightClick: [info: { event: Event; node: TreeNode }];
    contextmenu: [info: { event: Event; node: TreeNode }];

    // 异步加载
    load: [loadedKeys: Key[], info: { event: "load"; node: TreeNode }];

    // 拖拽事件
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

// 内部状态管理
const internalExpandedKeys: Ref<Key[]> = ref([]);
const internalSelectedKeys: Ref<Key[]> = ref([]);
const internalCheckedKeys: Ref<Key[]> = ref([]);
const internalHalfCheckedKeys: Ref<Key[]> = ref([]);

// 容器引用和高度计算
const containerRef = ref<HTMLElement>();
const computedHeight = ref<number>(200);

// 计算当前有效的keys
const currentExpandedKeys = computed(() =>
    props.expandedKeys.length > 0 ? props.expandedKeys : internalExpandedKeys.value,
);

const currentSelectedKeys = computed(() =>
    props.selectedKeys.length > 0 ? props.selectedKeys : internalSelectedKeys.value,
);

const currentCheckedKeys = computed(() => {
    if (Array.isArray(props.checkedKeys)) {
        return props.checkedKeys.length > 0 ? props.checkedKeys : internalCheckedKeys.value;
    } else if (props.checkedKeys.checked) {
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

// 转换为Set以提高查找性能
const expandedKeysSet = computed(() => new Set(currentExpandedKeys.value));
const selectedKeysSet = computed(() => new Set(currentSelectedKeys.value));
const checkedKeysSet = computed(() => new Set(currentCheckedKeys.value));
const halfCheckedKeysSet = computed(() => new Set(currentHalfCheckedKeys.value));

// 计算实际容器高度
const actualHeight = computed(() => {
    if (typeof props.height === "number") {
        return props.height;
    }
    return computedHeight.value;
});

// 树数据扁平化 - 虚拟化核心算法
const flattenTreeData = (
    nodes: TreeNode[],
    level = 0,
    parentExpanded = true,
): VirtualTreeNode[] => {
    const result: VirtualTreeNode[] = [];

    for (const node of nodes) {
        const isExpanded = expandedKeysSet.value.has(node.key);
        const hasChildren = !!(node.children && node.children.length > 0) && !node.isLeaf;

        // 修复：根节点总是可见，子节点只有在父节点展开时才可见
        const isVisible = level === 0 ? true : parentExpanded;

        // 添加当前节点（只有可见的节点才添加）
        if (isVisible) {
            result.push({
                key: node.key,
                title: node.title,
                level,
                isVisible,
                hasChildren,
                isExpanded,
                originalNode: node,
            });
        }

        // 递归处理子节点（只有当前节点展开时才处理子节点）
        if (hasChildren && isExpanded && node.children) {
            const childNodes = flattenTreeData(node.children, level + 1, isExpanded);
            result.push(...childNodes);
        }
    }

    return result;
};

// 可见节点列表（用于虚拟化）
const visibleFlatNodes = computed(() => {
    // 扁平化算法已经只返回可见节点，无需额外过滤
    const flatNodes = flattenTreeData(props.treeData);

    // 调试：检查是否有重复的 key
    if (process.env.NODE_ENV === "development") {
        const keyCount = new Map<Key, number>();
        flatNodes.forEach((node) => {
            keyCount.set(node.key, (keyCount.get(node.key) || 0) + 1);
        });

        const duplicates = Array.from(keyCount.entries()).filter(([_, count]) => count > 1);
        if (duplicates.length > 0) {
            console.warn("BaseTree: 检测到重复的节点 keys:", duplicates);
            console.warn("BaseTree: 扁平化节点数据:", flatNodes);
            console.warn("BaseTree: 原始树数据:", props.treeData);
        }
    }

    return flatNodes;
});

// 去重可见节点（防止数据源重复导致的问题）
const uniqueVisibleNodes = computed(() => {
    const nodes = visibleFlatNodes.value;
    const seen = new Set<Key>();
    const uniqueNodes: VirtualTreeNode[] = [];

    for (const node of nodes) {
        if (!seen.has(node.key)) {
            seen.add(node.key);
            uniqueNodes.push(node);
        } else if (process.env.NODE_ENV === "development") {
            console.warn(`BaseTree: 跳过重复节点 key="${node.key}" title="${node.title}"`);
        }
    }

    return uniqueNodes;
});

// 初始化默认状态
const initializeDefaults = () => {
    if (props.defaultExpandAll) {
        const allKeys = extractAllKeys(props.treeData);
        internalExpandedKeys.value = allKeys;
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

// 提取所有节点keys
const extractAllKeys = (nodes: TreeNode[]): Key[] => {
    const keys: Key[] = [];

    const traverse = (nodeList: TreeNode[]) => {
        for (const node of nodeList) {
            keys.push(node.key);
            if (node.children && node.children.length > 0) {
                traverse(node.children);
            }
        }
    };

    traverse(nodes);
    return keys;
};

// 查找节点
const findNode = (key: Key, nodes: TreeNode[] = props.treeData): TreeNode | null => {
    for (const node of nodes) {
        if (node.key === key) {
            return node;
        }
        if (node.children) {
            const found = findNode(key, node.children);
            if (found) return found;
        }
    }
    return null;
};

// 事件处理器
const handleNodeExpand = (node: TreeNode, expanded?: boolean) => {
    const newExpanded = expanded !== undefined ? expanded : !expandedKeysSet.value.has(node.key);
    let newExpandedKeys: Key[];

    if (newExpanded) {
        newExpandedKeys = [...currentExpandedKeys.value, node.key];
    } else {
        newExpandedKeys = currentExpandedKeys.value.filter((key) => key !== node.key);
    }

    internalExpandedKeys.value = newExpandedKeys;
    emit("update:expandedKeys", newExpandedKeys);

    const expandInfo: ExpandInfo = {
        node,
        expanded: newExpanded,
        nativeEvent: new Event("expand"),
    };

    emit("expand", newExpandedKeys, expandInfo);
};

const handleNodeSelect = (node: TreeNode, selected?: boolean, event?: Event) => {
    const newSelected = selected !== undefined ? selected : !selectedKeysSet.value.has(node.key);
    let newSelectedKeys: Key[];

    if (props.multiple) {
        if (newSelected) {
            newSelectedKeys = [...currentSelectedKeys.value, node.key];
        } else {
            newSelectedKeys = currentSelectedKeys.value.filter((key) => key !== node.key);
        }
    } else {
        newSelectedKeys = newSelected ? [node.key] : [];
    }

    internalSelectedKeys.value = newSelectedKeys;
    emit("update:selectedKeys", newSelectedKeys);

    const selectInfo: SelectInfo = {
        event: "select",
        selected: newSelected,
        node,
        selectedNodes: newSelectedKeys.map((key) => findNode(key)).filter(Boolean) as TreeNode[],
        nativeEvent: event || new Event("select"),
    };

    emit("select", newSelectedKeys, selectInfo);
};

const handleNodeCheck = (node: TreeNode, checked?: boolean, event?: Event) => {
    const newChecked = checked !== undefined ? checked : !checkedKeysSet.value.has(node.key);
    let newCheckedKeys: Key[];
    const newHalfCheckedKeys: Key[] = [...currentHalfCheckedKeys.value];

    if (newChecked) {
        newCheckedKeys = [...currentCheckedKeys.value, node.key];
    } else {
        newCheckedKeys = currentCheckedKeys.value.filter((key) => key !== node.key);
    }

    // 如果不是严格模式，需要级联选择子节点和更新父节点状态
    if (!props.checkStrictly) {
        // TODO: 实现级联选择逻辑
    }

    internalCheckedKeys.value = newCheckedKeys;
    internalHalfCheckedKeys.value = newHalfCheckedKeys;

    const checkedKeysResult = props.checkStrictly
        ? newCheckedKeys
        : {
              checked: newCheckedKeys,
              halfChecked: newHalfCheckedKeys,
          };

    emit("update:checkedKeys", checkedKeysResult);

    const checkInfo: CheckInfo = {
        event: "check",
        node,
        checked: newChecked,
        nativeEvent: event || new Event("check"),
        checkedNodes: newCheckedKeys.map((key) => findNode(key)).filter(Boolean) as TreeNode[],
        halfCheckedKeys: newHalfCheckedKeys,
    };

    emit("check", checkedKeysResult, checkInfo);
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

// 高度计算函数
const updateHeight = () => {
    if (typeof props.height === "string" && containerRef.value) {
        const rect = containerRef.value.getBoundingClientRect();
        computedHeight.value = rect.height || 200;
    }
};

// 使用 ResizeObserver 监听容器尺寸变化
let resizeObserver: ResizeObserver | null = null;

// 组件初始化
onMounted(() => {
    initializeDefaults();

    if (typeof props.height === "string") {
        // 初始高度计算
        nextTick(() => {
            updateHeight();
        });

        // 监听尺寸变化
        if (containerRef.value && window.ResizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                updateHeight();
            });
            resizeObserver.observe(containerRef.value);
        }
    }
});

// 清理监听器
const cleanup = () => {
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
};

// 组件卸载时清理
onUnmounted(() => {
    cleanup();
});

// 监听treeData变化
watch(
    () => props.treeData,
    () => {
        if (props.defaultExpandAll) {
            const allKeys = extractAllKeys(props.treeData);
            internalExpandedKeys.value = allKeys;
            emit("update:expandedKeys", allKeys);
        }
    },
    { deep: true },
);
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

/* 虚拟化模式样式 */
.base-tree--virtual {
    overflow: hidden;
}

/* 连接线样式 */
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
