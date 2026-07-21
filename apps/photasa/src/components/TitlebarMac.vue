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
    background: var(--color-header-bg, var(--color-bg));
    border-bottom: 1px solid var(--color-header-border, var(--color-border));
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
    color: var(--color-primary);
    font-weight: 500;
}
.setting-header {
    float: right;
    margin-right: 16px;
    -webkit-app-region: no-drag;
}
.system-icon {
    height: 18px;
    width: 18px;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1));
}

/* 多彩图标样式 */
.system-icon:nth-child(1) {
    /* 时钟图标 - 蓝色渐变 */
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.system-icon:nth-child(2) {
    /* 仪表板图标 - 紫色渐变 */
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.system-icon:nth-child(3) {
    /* 文件夹图标 - 绿色渐变 */
    background: linear-gradient(135deg, #10b981, #059669);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.system-icon:nth-child(4) {
    /* 设置图标 - 橙色渐变 */
    background: linear-gradient(135deg, #f59e0b, #d97706);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

/* 悬停效果 */
.system-icon:hover {
    transform: scale(1.15) rotate(5deg);
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}

.system-icon:nth-child(1):hover {
    background: linear-gradient(135deg, #60a5fa, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.system-icon:nth-child(2):hover {
    background: linear-gradient(135deg, #a78bfa, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.system-icon:nth-child(3):hover {
    background: linear-gradient(135deg, #34d399, #10b981);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.system-icon:nth-child(4):hover {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
</style>
