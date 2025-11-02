<template>
    <div
        class="base-tree-node"
        :class="[
            isSelected && 'base-tree-node--selected',
            disabled && 'base-tree-node--disabled',
            blockNode && 'base-tree-node--block',
        ]"
        :style="{ paddingLeft: level * 20 + 'px' }"
        :data-node-key="node.key"
        @click="handleClick"
        @dblclick="handleDblclick"
        @contextmenu="handleContextmenu"
    >
        <!-- 展开/折叠图标 -->
        <span
            v-if="hasChildren"
            class="base-tree-node__switcher"
            :class="{
                'base-tree-node__switcher--expanded': isExpanded,
                'base-tree-node__switcher--collapsed': !isExpanded,
            }"
            @click.stop="handleExpandClick"
        >
            <slot name="switcherIcon" :node="node" :expanded="isExpanded">
                <svg
                    class="base-tree-node__switcher-icon"
                    :class="{ 'base-tree-node__switcher-icon--expanded': isExpanded }"
                    viewBox="0 0 1024 1024"
                    width="12"
                    height="12"
                >
                    <path
                        d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v70.4c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V869c0 6.5 7.4 10.3 12.9 6.3l450.8-352.1a31.96 31.96 0 000-50.4z"
                        fill="currentColor"
                    />
                </svg>
            </slot>
        </span>
        <span v-else class="base-tree-node__switcher base-tree-node__switcher--noop"></span>

        <!-- 复选框 -->
        <span
            v-if="checkable && !node.disableCheckbox"
            class="base-tree-node__checkbox"
            :class="{
                'base-tree-node__checkbox--checked': isChecked,
                'base-tree-node__checkbox--indeterminate': isHalfChecked,
                'base-tree-node__checkbox--disabled': disabled,
            }"
            @click.stop="handleCheckClick"
        >
            <input
                type="checkbox"
                :checked="isChecked"
                :indeterminate="isHalfChecked"
                :disabled="disabled"
                class="base-tree-node__checkbox-input"
                @change="handleCheckboxChange"
            />
            <span class="base-tree-node__checkbox-inner"></span>
        </span>

        <!-- 图标 -->
        <span v-if="showIcon" class="base-tree-node__icon">
            <slot name="icon" :node="node" :has-children="hasChildren">
                <!-- 无默认图标，由使用者决定 -->
            </slot>
        </span>

        <!-- 节点内容 -->
        <span
            class="base-tree-node__title"
            :class="{
                'base-tree-node__title--selectable': selectable && !disabled,
            }"
            @click="handleTitleClick"
        >
            <slot name="title" :node="node" :key="node.key" :title="node.title">
                {{ node.title }}
            </slot>
        </span>

        <!-- 连接线（如果启用 showLine） -->
        <div v-if="showLine" class="base-tree-node__line">
            <!-- 垂直连接线 -->
            <div
                v-if="level > 0"
                class="base-tree-node__line-vertical"
                :style="{ left: (level - 1) * 20 + 10 + 'px' }"
            ></div>
            <!-- 水平连接线 -->
            <div
                v-if="level > 0"
                class="base-tree-node__line-horizontal"
                :style="{ left: (level - 1) * 20 + 10 + 'px' }"
            ></div>
        </div>
    </div>

    <!-- 递归渲染子节点（非虚拟模式） -->
    <template v-if="!virtual && hasChildren && isExpanded">
        <BaseTreeNode
            v-for="child in node.children"
            :key="child.key"
            :node="child"
            :level="level + 1"
            :is-expanded="expandedKeysSet?.has(child.key) || false"
            :is-selected="selectedKeysSet?.has(child.key) || false"
            :is-checked="checkedKeysSet?.has(child.key) || false"
            :is-half-checked="halfCheckedKeysSet?.has(child.key) || false"
            :checkable="checkable"
            :selectable="selectable"
            :show-icon="showIcon"
            :show-line="showLine"
            :disabled="disabled || child.disabled"
            :block-node="blockNode"
            :expanded-keys-set="expandedKeysSet"
            :selected-keys-set="selectedKeysSet"
            :checked-keys-set="checkedKeysSet"
            :half-checked-keys-set="halfCheckedKeysSet"
            :virtual="virtual"
            @expand="(node, expanded) => $emit('expand', node, expanded)"
            @select="(node, selected, e) => $emit('select', node, selected, e)"
            @check="(node, checked, e) => $emit('check', node, checked, e)"
            @click="(node, e) => $emit('click', node, e)"
            @dblclick="(node, e) => $emit('dblclick', node, e)"
            @contextmenu="(node, e) => $emit('contextmenu', node, e)"
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
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { FolderNode } from "@common/folder-types";

export type Key = string | number;

interface TreeNode extends FolderNode {
    key: Key;
    title: string;
    children?: TreeNode[];
    isLeaf?: boolean;
    disabled?: boolean;
    selectable?: boolean;
    disableCheckbox?: boolean;
    icon?: any;
    [key: string]: any;
}

interface Props {
    node: TreeNode;
    level: number;
    isExpanded?: boolean;
    isSelected?: boolean;
    isChecked?: boolean;
    isHalfChecked?: boolean;
    checkable?: boolean;
    selectable?: boolean;
    showIcon?: boolean;
    showLine?: boolean;
    disabled?: boolean;
    blockNode?: boolean;

    // 用于递归渲染（非虚拟模式）
    expandedKeysSet?: Set<Key>;
    selectedKeysSet?: Set<Key>;
    checkedKeysSet?: Set<Key>;
    halfCheckedKeysSet?: Set<Key>;
    virtual?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isExpanded: false,
    isSelected: false,
    isChecked: false,
    isHalfChecked: false,
    checkable: false,
    selectable: true,
    showIcon: true,
    showLine: false,
    disabled: false,
    blockNode: false,
    virtual: false,
});

const emit = defineEmits<{
    expand: [node: TreeNode, expanded?: boolean];
    select: [node: TreeNode, selected?: boolean, e?: Event];
    check: [node: TreeNode, checked?: boolean, e?: Event];
    click: [node: TreeNode, e: Event];
    dblclick: [node: TreeNode, e: Event];
    contextmenu: [node: TreeNode, e: Event];
}>();

// 从父组件注入的上下文（暂未使用但保留以备扩展）
// const _treeContext = inject("treeContext", {
//     checkStrictly: false,
//     multiple: false,
//     virtual: false,
// });

// 计算属性
const hasChildren = computed(() => {
    return !!(props.node.children && props.node.children.length > 0) && !props.node.isLeaf;
});

// 事件处理器
const handleExpandClick = () => {
    if (hasChildren.value) {
        emit("expand", props.node, !props.isExpanded);
    }
};

const handleClick = (e: Event) => {
    emit("click", props.node, e);
};

const handleTitleClick = (e: Event) => {
    if (props.selectable && !props.disabled) {
        emit("select", props.node, !props.isSelected, e);
    }
};

const handleCheckClick = () => {
    if (props.checkable && !props.disabled && !props.node.disableCheckbox) {
        emit("check", props.node, !props.isChecked);
    }
};

const handleCheckboxChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    emit("check", props.node, target.checked, e);
};

const handleDblclick = (e: Event) => {
    emit("dblclick", props.node, e);
};

const handleContextmenu = (e: Event) => {
    emit("contextmenu", props.node, e);
};
</script>

<style scoped>
.base-tree-node {
    position: relative;
    display: flex;
    align-items: center;
    padding: 4px 0;
    cursor: pointer;
    transition: background-color 0.2s;
    user-select: none;
    color: var(--color-text, #000);
}

.base-tree-node:hover {
    background-color: var(--color-tree-hover, rgba(0, 0, 0, 0.04));
}

.base-tree-node--selected {
    background-color: var(--color-tree-selected, rgba(24, 144, 255, 0.1));
    color: var(--color-primary, #1890ff);
}

.base-tree-node--disabled {
    color: var(--color-text-disabled, rgba(0, 0, 0, 0.25));
    cursor: not-allowed;
}

.base-tree-node--disabled:hover {
    background-color: transparent;
}

.base-tree-node--block {
    padding-left: 0;
    padding-right: 0;
}

/* 展开/折叠开关 */
.base-tree-node__switcher {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin-right: 4px;
    cursor: pointer;
    border-radius: 2px;
    transition: all 0.2s;
}

.base-tree-node__switcher:hover {
    background-color: var(--color-tree-switcher-hover, rgba(0, 0, 0, 0.06));
}

.base-tree-node__switcher--noop {
    cursor: default;
}

.base-tree-node__switcher--noop:hover {
    background-color: transparent;
}

.base-tree-node__switcher-icon {
    transition: transform 0.2s;
    color: var(--color-text-secondary, rgba(0, 0, 0, 0.45));
}

.base-tree-node__switcher-icon--expanded {
    transform: rotate(90deg);
}

/* 复选框 */
.base-tree-node__checkbox {
    position: relative;
    display: inline-flex;
    align-items: center;
    margin-right: 8px;
    cursor: pointer;
}

.base-tree-node__checkbox-input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    width: 16px;
    height: 16px;
    margin: 0;
}

.base-tree-node__checkbox-inner {
    position: relative;
    display: block;
    width: 16px;
    height: 16px;
    border: 1px solid var(--color-border, #d9d9d9);
    border-radius: 2px;
    background-color: var(--color-white);
    transition: all 0.2s;
}

.base-tree-node__checkbox-inner::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(45deg) scale(0);
    width: 5px;
    height: 8px;
    border: 2px solid var(--color-white);
    border-top: 0;
    border-left: 0;
    transition: all 0.2s;
}

.base-tree-node__checkbox--checked .base-tree-node__checkbox-inner {
    background-color: var(--color-primary, #1890ff);
    border-color: var(--color-primary, #1890ff);
}

.base-tree-node__checkbox--checked .base-tree-node__checkbox-inner::after {
    transform: translate(-50%, -50%) rotate(45deg) scale(1);
}

.base-tree-node__checkbox--indeterminate .base-tree-node__checkbox-inner {
    background-color: var(--color-primary, #1890ff);
    border-color: var(--color-primary, #1890ff);
}

.base-tree-node__checkbox--indeterminate .base-tree-node__checkbox-inner::after {
    content: "";
    transform: translate(-50%, -50%) scale(1);
    width: 8px;
    height: 0;
    border: 1px solid var(--color-white);
    border-radius: 1px;
}

.base-tree-node__checkbox--disabled {
    cursor: not-allowed;
}

.base-tree-node__checkbox--disabled .base-tree-node__checkbox-inner {
    background-color: var(--color-bg-disabled, #f5f5f5);
    border-color: var(--color-border, #d9d9d9);
}

/* 图标 */
.base-tree-node__icon {
    display: inline-flex;
    align-items: center;
    margin-right: 4px;
    color: var(--color-text-secondary, rgba(0, 0, 0, 0.45));
}

.base-tree-node__icon-folder,
.base-tree-node__icon-file {
    display: block;
}

/* 标题 */
.base-tree-node__title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 20px;
}

.base-tree-node__title--selectable:hover {
    color: var(--color-primary, #1890ff);
}

/* 连接线 */
.base-tree-node__line {
    position: absolute;
    pointer-events: none;
}

.base-tree-node__line-vertical,
.base-tree-node__line-horizontal {
    position: absolute;
    border-left: 1px solid var(--color-border, #d9d9d9);
}

.base-tree-node__line-vertical {
    top: 0;
    bottom: 0;
    width: 0;
}

.base-tree-node__line-horizontal {
    top: 50%;
    width: 10px;
    height: 0;
    border-top: 1px solid var(--color-border, #d9d9d9);
    border-left: none;
}
</style>
