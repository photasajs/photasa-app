<template>
    <nav class="breadcrumb" role="navigation" aria-label="breadcrumb">
        <ol class="breadcrumb-list">
            <slot></slot>
        </ol>
    </nav>
</template>

<script setup lang="ts">
// Base breadcrumb component that provides slots for items
</script>

<style scoped>
.breadcrumb {
    color: var(--color-text-secondary);
    font-size: 14px;
}

.breadcrumb-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin: 0;
    padding: 0;
    list-style: none;
}
</style>
