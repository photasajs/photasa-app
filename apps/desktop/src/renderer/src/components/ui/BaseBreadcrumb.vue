<template>
    <nav class="base-breadcrumb" :aria-label="ariaLabel">
        <ol class="breadcrumb-list">
            <slot />
        </ol>
    </nav>
</template>

<script setup lang="ts">
interface Props {
    ariaLabel?: string;
}

withDefaults(defineProps<Props>(), {
    ariaLabel: "Breadcrumb navigation",
});
</script>

<style scoped lang="less">
.base-breadcrumb {
    .breadcrumb-list {
        display: flex;
        align-items: center;
        list-style: none;
        margin: 0;
        padding: 0;
        font-size: 14px;
        line-height: 1.5715;
        color: var(--color-tree-text, var(--color-text, #000));
    }
}
</style>
