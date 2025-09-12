<template>
    <!-- Fallback rendering if not injected into descriptions -->
    <div v-if="!descriptions" class="descriptions-item" :style="{ gridColumn: `span ${span}` }">
        <div class="descriptions-item-label">
            {{ label }}
        </div>
        <div class="descriptions-item-content">
            <slot />
        </div>
    </div>
</template>

<script setup lang="ts">
import { inject, onMounted, onBeforeUnmount, getCurrentInstance, useSlots } from "vue";
import type { DescriptionItem } from "./BaseDescriptions.vue";

interface BaseDescriptionItemProps {
    label: string;
    span?: number;
    noColon?: boolean;
}

const props = withDefaults(defineProps<BaseDescriptionItemProps>(), {
    span: 1,
    noColon: false,
});

const descriptions = inject<{
    addItem: (item: DescriptionItem) => void;
    removeItem: (key: string) => void;
    bordered: boolean;
    colon: boolean;
    size: string;
}>("descriptions");

const slots = useSlots();
const instance = getCurrentInstance();
const key = instance?.uid.toString() || Math.random().toString(36);

onMounted(() => {
    if (descriptions) {
        descriptions.addItem({
            key,
            label: props.label,
            content: "",
            component: slots.default ? () => slots.default?.() : undefined,
            span: props.span,
            noColon: props.noColon || !descriptions.colon,
        });
    }
});

onBeforeUnmount(() => {
    if (descriptions) {
        descriptions.removeItem(key);
    }
});
</script>

<style scoped>
.descriptions-item {
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

.descriptions-item:hover {
    background: linear-gradient(90deg, var(--color-bg-secondary) 0%, var(--color-bg-tertiary) 100%);
    transform: translateX(4px);
}

.descriptions-item:first-child {
    border-radius: 20px 20px 0 0;
}

.descriptions-item:last-child {
    border-radius: 0 0 20px 20px;
}

.descriptions-item-label {
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

.descriptions-item-label::after {
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

.descriptions-item-content {
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

.descriptions-item-content::before {
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

.descriptions-item:hover .descriptions-item-content::before {
    opacity: 1;
}

.descriptions-item-content::after {
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
</style>
