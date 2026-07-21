<template>
    <header class="titlebar-container">
        <!-- Draggable background handle -->
        <div class="titlebar-drag-handle" data-tauri-drag-region />
        
        <!-- Header content layer -->
        <div class="titlebar-content">
            <!-- Space for macOS native traffic lights (no-drag) -->
            <div class="traffic-placeholder" />
            
            <!-- Absolutely centered title -->
            <span class="app-title">{{ t("app.title") }}</span>
            
            <!-- Action buttons area (clickable) -->
            <div class="setting-header">
                <CoffeeOutlined class="system-icon" @click="openScanList" />
                <DashboardOutlined class="system-icon" @click="openQueueDashboard" />
                <ImportOutlined class="system-icon" @click="openImportPhotos" />
                <SettingOutlined class="system-icon" @click="openPreference" />
            </div>
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
    position: relative;
    height: var(--photasa-header-height, 36px);
    width: 100%;
    background: var(--color-bg-secondary, var(--color-bg));
    border-bottom: 1px solid var(--color-border);
    user-select: none;
    overflow: hidden;
}

.titlebar-drag-handle {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 0;
    cursor: default;
}

.titlebar-content {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    pointer-events: none; /* Let clicks pass through to drag handle */
}

.traffic-placeholder {
    width: 80px;
    height: 100%;
    flex-shrink: 0;
}

.app-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    color: var(--color-text-primary, var(--color-text));
    font-weight: 600;
    font-size: 13px;
    letter-spacing: -0.01em;
    pointer-events: none;
}

.setting-header {
    margin-left: auto; /* Push to far right */
    display: flex;
    align-items: center;
    gap: 16px;
    padding-right: 16px;
    height: 100%;
    pointer-events: auto; /* Re-enable pointer events for buttons */
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
