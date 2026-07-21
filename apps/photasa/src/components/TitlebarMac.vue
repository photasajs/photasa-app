<template>
    <header class="titlebar-container">
        <div class="app-header">
            <BaseSpace class="title-header">
                <span class="app-title">{{ t("app.title") }}</span>
            </BaseSpace>
            <BaseSpace class="setting-header">
                <CoffeeOutlined class="system-icon" @click="openScanList"></CoffeeOutlined>
                <DashboardOutlined
                    class="system-icon"
                    @click="openQueueDashboard"
                ></DashboardOutlined>
                <ImportOutlined class="system-icon" @click="openImportPhotos"></ImportOutlined>
                <SettingOutlined class="system-icon" @click="openPreference" />
            </BaseSpace>
        </div>
    </header>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { BaseSpace } from "@renderer/components/ui";
import {
    PhClock as CoffeeOutlined,
    PhFolder as ImportOutlined,
    PhGear as SettingOutlined,
    PhChartLineUp as DashboardOutlined,
} from "@phosphor-icons/vue";

const { t } = useI18n();
// ✅ RFC 0058: Introducting ZhangSunWuJi Service for menu management
// Note: syncing logic is now handled in App.vue via refreshMenus
// const zhangSunWuJi = useZhangSunWuJi();

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
}

.app-header {
    height: var(--photasa-header-height, 36px);
    margin-left: 36px;
    padding-left: 50px;
    line-height: 36px;
    display: flex;
    color: var(--color-header-text, var(--color-text));
}
.title-header {
    flex-grow: 1;
    user-select: none;
    -webkit-app-region: drag;
}

.app-title {
    color: var(--color-text-primary, var(--color-text));
    font-weight: 600;
    font-size: 13px;
    letter-spacing: -0.01em;
}
.setting-header {
    float: right;
    margin-right: 16px;
    -webkit-app-region: no-drag;
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
