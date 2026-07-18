<template>
    <div class="setting-item">
        <div class="setting-label">
            <span class="label-text">{{ label }}</span>
            <span v-if="description" class="setting-desc">{{ description }}</span>
        </div>
        <div class="setting-control">
            <slot />
        </div>
    </div>
</template>

<script setup lang="ts">
interface Props {
    label: string;
    description?: string;
}

defineProps<Props>();
</script>

<style scoped lang="scss">
.setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;

    &:not(:last-child) {
        border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.05));
    }
}

.setting-label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .label-text {
        font-size: 14px;
        color: var(--color-text, #fff);
        font-weight: 500;
    }
}

.setting-desc {
    font-size: 12px;
    color: var(--color-text-secondary, rgba(255, 255, 255, 0.5));
    line-height: 1.4;
}

.setting-control {
    min-width: 160px;
    display: flex;
    justify-content: flex-end;
}
</style>
