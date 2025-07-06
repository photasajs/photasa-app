<template>
    <img :src="iconSrc" class="app-icon" alt="App Icon" draggable="false" />
</template>

<script setup lang="ts">
import iconUrl from "@renderer/assets/icon.png";

// 无需主题切换，直接使用唯一图标
const iconSrc = iconUrl;
</script>

<style scoped>
.app-icon {
    width: 22px;
    height: 22px;
    margin-left: 12px;
    margin-right: 8px;
    user-select: none;
    pointer-events: none;
    vertical-align: middle;
}
</style>
