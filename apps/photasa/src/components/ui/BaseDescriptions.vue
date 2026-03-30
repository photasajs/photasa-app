<template>
    <div
        class="descriptions"
        :class="[`descriptions-${layout}`, { 'descriptions-bordered': bordered }]"
    >
        <!-- Title -->
        <div v-if="title" class="descriptions-title">{{ title }}</div>

        <!-- Content based on layout -->
        <div v-if="layout === 'horizontal'" class="descriptions-view">
            <table class="descriptions-table">
                <tbody>
                    <tr v-for="(row, rowIndex) in rows" :key="rowIndex" class="descriptions-row">
                        <template v-for="item in row" :key="item.key">
                            <td
                                class="descriptions-item-label"
                                :class="{ 'descriptions-item-no-colon': item.noColon }"
                                :style="labelStyles"
                            >
                                {{ item.label }}
                            </td>
                            <td
                                class="descriptions-item-content"
                                :colspan="getContentColspan(item)"
                            >
                                <component :is="item.component" v-if="item.component" />
                                <span v-else>{{ item.content }}</span>
                            </td>
                        </template>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-else class="descriptions-view">
            <div
                class="descriptions-list"
                :style="{ gridTemplateColumns: `repeat(${column}, 1fr)` }"
            >
                <div
                    v-for="item in items"
                    :key="item.key"
                    class="descriptions-item"
                    :style="{ gridColumn: item.span ? `span ${item.span}` : 'span 1' }"
                >
                    <div
                        class="descriptions-item-label"
                        :class="{ 'descriptions-item-no-colon': item.noColon }"
                    >
                        {{ item.label }}
                    </div>
                    <div class="descriptions-item-content">
                        <component :is="item.component" v-if="item.component" />
                        <span v-else>{{ item.content }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Fallback: render slot content directly if no items registered -->
        <div v-if="items.length === 0" class="descriptions-view descriptions-fallback">
            <div
                class="descriptions-list"
                :style="{ gridTemplateColumns: `repeat(${column}, 1fr)` }"
            >
                <slot />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, provide, ref } from "vue";

export interface DescriptionItem {
    key: string;
    label: string;
    content?: string;
    component?: any;
    span?: number;
    noColon?: boolean;
}

interface BaseDescriptionsProps {
    title?: string;
    layout?: "horizontal" | "vertical";
    bordered?: boolean;
    column?: number;
    size?: "default" | "middle" | "small";
    labelStyle?: Record<string, string>;
    contentStyle?: Record<string, string>;
    colon?: boolean;
}

const props = withDefaults(defineProps<BaseDescriptionsProps>(), {
    layout: "horizontal",
    bordered: false,
    column: 3,
    size: "default",
    colon: true,
});

// Provide context for child components
const items = ref<DescriptionItem[]>([]);

provide("descriptions", {
    addItem: (item: DescriptionItem) => {
        items.value.push(item);
    },
    removeItem: (key: string) => {
        const index = items.value.findIndex((item) => item.key === key);
        if (index > -1) {
            items.value.splice(index, 1);
        }
    },
    bordered: props.bordered,
    colon: props.colon,
    size: props.size,
});

// Computed styles
const labelStyles = computed(() => ({
    ...props.labelStyle,
}));

// For horizontal layout, organize items into rows
const rows = computed(() => {
    if (props.layout !== "horizontal") return [];

    const result: DescriptionItem[][] = [];
    let currentRow: DescriptionItem[] = [];
    let currentColumns = 0;

    for (const item of items.value) {
        const itemSpan = item.span || 1;

        if (currentColumns + itemSpan > props.column) {
            if (currentRow.length > 0) {
                result.push(currentRow);
                currentRow = [];
                currentColumns = 0;
            }
        }

        currentRow.push(item);
        currentColumns += itemSpan;

        if (currentColumns >= props.column) {
            result.push(currentRow);
            currentRow = [];
            currentColumns = 0;
        }
    }

    if (currentRow.length > 0) {
        result.push(currentRow);
    }

    return result;
});

const getContentColspan = (item: DescriptionItem) => {
    return (item.span || 1) * 2 - 1;
};
</script>

<style scoped>
.descriptions {
    color: var(--color-text);
    font-size: 14px;
    line-height: 1.6;
    background: linear-gradient(
        135deg,
        var(--color-bg) 0%,
        var(--color-bg-secondary) 40%,
        var(--color-bg-tertiary) 100%
    );
    border-radius: 20px;
    padding: 0;
    border: none;
    box-shadow: var(--shadow-modern-lg);
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
}

.descriptions::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--color-primary, #1890ff) 20%,
        var(--color-primary, #1890ff) 80%,
        transparent 100%
    );
    opacity: 0.6;
}

.descriptions-title {
    color: var(--color-text-primary);
    font-weight: 800;
    font-size: 22px;
    line-height: 1.2;
    margin: 0;
    padding: 32px 32px 24px 32px;
    background: linear-gradient(135deg, var(--color-bg) 0%, var(--color-bg-secondary) 100%);
    border-radius: 20px 20px 0 0;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    gap: 16px;
    position: relative;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

.descriptions-title::before {
    content: "📊";
    font-size: 18px;
    filter: grayscale(0.2);
}

.descriptions-title::after {
    content: "";
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 60px;
    height: 2px;
    background: linear-gradient(90deg, var(--color-primary) 0%, transparent 100%);
    border-radius: 1px;
}

.descriptions-view {
    width: 100%;
}

/* Table layout for horizontal */
.descriptions-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
}

.descriptions-table {
    background: var(--color-bg);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px var(--color-shadow, rgba(0, 0, 0, 0.1));
}

.descriptions-bordered .descriptions-table {
    border: 1px solid var(--color-border);
}

.descriptions-row {
    border-bottom: 1px solid var(--color-border);
    transition: background-color 0.2s ease;
}

.descriptions-row:hover {
    background: var(--color-bg-secondary);
}

.descriptions-bordered .descriptions-row td {
    border-right: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
}

.descriptions-item-label {
    padding: 16px 20px;
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 13px;
    line-height: 1.4;
    text-align: left;
    background: var(--color-bg-secondary);
    position: relative;
    vertical-align: top;
    width: 30%;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.descriptions-item-label:not(.descriptions-item-no-colon)::after {
    content: ":";
    position: relative;
    margin-inline-start: 2px;
    margin-inline-end: 8px;
    color: var(--color-primary);
}

.descriptions-item-content {
    padding: 16px 20px;
    color: var(--color-text);
    font-size: 14px;
    line-height: 1.5;
    word-break: break-word;
    vertical-align: top;
    background: var(--color-bg);
}

/* Grid layout for vertical - 现代卡片式设计 */
.descriptions-list {
    display: grid;
    gap: 2px;
    padding: 0;
    margin: 0;
}

.descriptions-vertical .descriptions-item {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    background: linear-gradient(90deg, var(--color-bg) 0%, var(--color-bg-secondary) 100%);
    border: none;
    margin: 0;
    overflow: hidden;
    position: relative;
    transition: var(--transition-modern);
    min-height: 72px;
}

.descriptions-vertical .descriptions-item:hover {
    background: linear-gradient(90deg, var(--color-bg-secondary) 0%, var(--color-bg-tertiary) 100%);
    transform: translateX(4px);
}

.descriptions-vertical .descriptions-item:first-child {
    border-radius: 0 0 0 0;
}

.descriptions-vertical .descriptions-item:last-child {
    border-radius: 0 0 20px 20px;
}

.descriptions-vertical .descriptions-item-label {
    padding: 20px 24px;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
    color: white;
    font-weight: 600;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    min-width: 140px;
    max-width: 140px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    position: relative;
    box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.1);
}

.descriptions-vertical .descriptions-item-label::after {
    content: "";
    position: absolute;
    right: -8px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid var(--color-primary-dark);
    border-top: 8px solid transparent;
    border-bottom: 8px solid transparent;
    z-index: 1;
}

.descriptions-vertical .descriptions-item-content {
    padding: 20px 24px;
    flex: 1;
    display: flex;
    align-items: center;
    color: var(--color-text);
    font-size: 15px;
    font-weight: 500;
    line-height: 1.4;
    position: relative;
    background: linear-gradient(90deg, transparent 0%, var(--color-bg) 10%, var(--color-bg) 100%);
}

/* 现代化附加效果 */
.descriptions-vertical .descriptions-item-content::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
    opacity: 0;
    transition: var(--transition-modern);
}

.descriptions-vertical .descriptions-item:hover .descriptions-item-content::before {
    opacity: 1;
}

.descriptions-vertical .descriptions-item-content::after {
    content: "";
    position: absolute;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 4px;
    background: var(--color-primary);
    border-radius: 50%;
    opacity: 0.3;
}

/* Size variants */
.descriptions.descriptions-middle .descriptions-item-label,
.descriptions.descriptions-middle .descriptions-item-content {
    padding: 12px 24px 12px 16px;
}

.descriptions.descriptions-small .descriptions-item-label,
.descriptions.descriptions-small .descriptions-item-content {
    padding: 8px 16px;
}

/* Responsive */
@media (max-width: 768px) {
    .descriptions-list {
        grid-template-columns: 1fr !important;
    }

    .descriptions-item-label {
        width: 100%;
        text-align: left;
    }
}
</style>
