<template>
    <div
        v-bind="$attrs"
        class="base-accordion-panel"
        :class="[
            `base-accordion-panel--${size}`,
            { 'base-accordion-panel--active': isActive },
            { 'base-accordion-panel--disabled': disabled },
        ]"
    >
        <!-- 面板头部 -->
        <div
            class="base-accordion-panel-header"
            :class="{ 'base-accordion-panel-header--active': isActive }"
            @click="handleToggle"
        >
            <div class="base-accordion-panel-header-content">
                <slot name="header">
                    <span class="base-accordion-panel-title">{{ header }}</span>
                </slot>
            </div>
            <div class="base-accordion-panel-extra">
                <slot name="extra" />
                <div
                    v-if="!disabled"
                    class="base-accordion-panel-arrow"
                    :class="{ 'base-accordion-panel-arrow--active': isActive }"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                            d="M3 4.5L6 7.5L9 4.5"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </div>
            </div>
        </div>

        <!-- 面板内容 -->
        <div
            v-show="isActive"
            class="base-accordion-panel-content"
            :class="{ 'base-accordion-panel-content--active': isActive }"
        >
            <div class="base-accordion-panel-content-inner">
                <slot />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { inject, computed } from "vue";

interface BaseAccordionPanelProps {
    /** 面板的唯一标识 */
    panelKey: string;
    /** 面板头部内容 */
    header?: string;
    /** 是否禁用 */
    disabled?: boolean;
    /** 是否强制渲染内容（即使未展开） */
    forceRender?: boolean;
    /** 自定义图标 */
    showArrow?: boolean;
}

const props = withDefaults(defineProps<BaseAccordionPanelProps>(), {
    disabled: false,
    forceRender: false,
    showArrow: true,
});

const accordionContext = inject<{
    accordion: boolean;
    activeKey: string | string[];
    defaultActiveKey: string | string[];
    collapsible: boolean;
    size: string;
    onChange: (key: string | string[]) => void;
}>("accordion");

const isActive = computed(() => {
    if (!accordionContext) return false;

    const { activeKey, defaultActiveKey, accordion } = accordionContext;
    const currentKey = activeKey || defaultActiveKey;

    if (accordion) {
        return currentKey === props.key;
    } else {
        return Array.isArray(currentKey) ? currentKey.includes(props.key) : false;
    }
});

const handleToggle = () => {
    if (props.disabled || !accordionContext?.collapsible) return;

    const { accordion, activeKey, defaultActiveKey, onChange } = accordionContext;
    const currentKey = activeKey || defaultActiveKey;

    if (accordion) {
        // 手风琴模式：切换当前面板
        onChange(isActive.value ? "" : props.key);
    } else {
        // 非手风琴模式：切换面板状态
        const keyArray = Array.isArray(currentKey) ? [...currentKey] : [];
        const index = keyArray.indexOf(props.key);

        if (index > -1) {
            keyArray.splice(index, 1);
        } else {
            keyArray.push(props.key);
        }

        onChange(keyArray);
    }
};
</script>

<style scoped>
.base-accordion-panel {
    border-bottom: 1px solid var(--color-border);
    transition: all 0.3s ease;
}

.base-accordion-panel:last-child {
    border-bottom: none;
}

.base-accordion-panel--disabled {
    opacity: 0.6;
    pointer-events: none;
}

.base-accordion-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    cursor: pointer;
    background: var(--color-card-bg);
    transition: all 0.3s ease;
    user-select: none;
}

.base-accordion-panel-header:hover {
    background: var(--color-card-hover);
}

.base-accordion-panel-header--active {
    background: var(--color-card-active);
}

.base-accordion-panel-header-content {
    flex: 1;
    color: var(--color-text);
    font-weight: 500;
}

.base-accordion-panel-title {
    font-size: 14px;
    line-height: 1.5;
}

.base-accordion-panel-extra {
    display: flex;
    align-items: center;
    gap: 8px;
}

.base-accordion-panel-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--color-text-secondary);
    transition: transform 0.3s ease;
}

.base-accordion-panel-arrow--active {
    transform: rotate(180deg);
}

.base-accordion-panel-content {
    background: var(--color-bg);
    overflow: hidden;
    transition: all 0.3s ease;
}

.base-accordion-panel-content-inner {
    padding: 16px 20px;
    color: var(--color-text-secondary);
    line-height: 1.6;
}

/* 尺寸变体 */
.base-accordion-panel--small .base-accordion-panel-header {
    padding: 12px 16px;
}

.base-accordion-panel--small .base-accordion-panel-title {
    font-size: 12px;
}

.base-accordion-panel--small .base-accordion-panel-content-inner {
    padding: 12px 16px;
}

.base-accordion-panel--large .base-accordion-panel-header {
    padding: 20px 24px;
}

.base-accordion-panel--large .base-accordion-panel-title {
    font-size: 16px;
}

.base-accordion-panel--large .base-accordion-panel-content-inner {
    padding: 20px 24px;
}
</style>
