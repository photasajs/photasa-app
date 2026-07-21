<template>
    <header class="titlebar-container">
        <!-- Traffic lights click-through protector -->
        <div class="traffic-placeholder" />
        
        <div class="app-header-content">
            <span class="app-title">{{ t("app.title") }}</span>
            
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
    height: var(--photasa-header-height, 36px);
    width: 100%;
    background: var(--color-bg-secondary, var(--color-bg));
    border-bottom: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    user-select: none;
    -webkit-app-region: drag; /* Entire titlebar is draggable by default */
}

/* Explicit no-drag zone for macOS native traffic lights (width ~80px) */
.traffic-placeholder {
    width: 80px;
    height: 100%;
    flex-shrink: 0;
    -webkit-app-region: no-drag;
}

.app-header-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
    padding-right: 16px;
}

.app-title {
    color: var(--color-text-primary, var(--color-text));
    font-weight: 600;
    font-size: 13px;
    letter-spacing: -0.01em;
    pointer-events: none; /* Let drag clicks pass through the title text */
}

.setting-header {
    display: flex;
    align-items: center;
    gap: 16px;
    -webkit-app-region: no-drag; /* Buttons must be clickable and not drag the window */
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
