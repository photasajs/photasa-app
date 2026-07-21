<template>
    <header class="titlebar-container">
        <!-- Traffic lights click-through protector (no-drag) -->
        <div class="traffic-placeholder" />
        
        <!-- Draggable area (spacer/title) -->
        <div class="draggable-area" data-tauri-drag-region>
            <span class="app-title" data-tauri-drag-region>{{ t("app.title") }}</span>
        </div>
        
        <!-- Action buttons area (no-drag) -->
        <div class="setting-header">
            <CoffeeOutlined class="system-icon" @click="openScanList" />
            <DashboardOutlined class="system-icon" @click="openQueueDashboard" />
            <ImportOutlined class="system-icon" @click="openImportPhotos" />
            <SettingOutlined class="system-icon" @click="openPreference" />
        </div>
    </header>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import {
    PhClock as CoffeeOutlined,
    PhFolder as ImportOutlined,
    PhGear as SettingOutlined,
    PhChartLineUp as DashboardOutlined,
} from "@phosphor-icons/vue";

const { t } = useI18n();

const emit = defineEmits([
    "openScanList",
    "openQueueDashboard",
    "openImportPhotos",
    "openPreference",
    "menu-action",
]);

function openScanList() {
    emit("openScanList");
}
function openQueueDashboard() {
    emit("openQueueDashboard");
}
function openImportPhotos() {
    emit("openImportPhotos");
}
function openPreference() {
    emit("openPreference");
}
</script>

<style lang="less" scoped>
.titlebar-container {
    height: var(--photasa-header-height, 36px);
    width: 100%;
    background: var(--color-bg-secondary, var(--color-bg));
    border-bottom: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    user-select: none;
}

.traffic-placeholder {
    width: 80px;
    height: 100%;
    flex-shrink: 0;
}

.draggable-area {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: default;
}

.app-title {
    color: var(--color-text-primary, var(--color-text));
    font-weight: 600;
    font-size: 13px;
    letter-spacing: -0.01em;
}

.setting-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-right: 16px;
    height: 100%;
}

.system-icon {
    height: 16px;
    width: 16px;
    font-size: 16px;
    cursor: pointer;
    color: var(--color-text-secondary, #cccccc);
    transition: color 0.15s ease, opacity 0.15s ease;
    opacity: 0.85;

    &:hover {
        opacity: 1;
        color: var(--color-primary, #3794ff);
    }
}
</style>
