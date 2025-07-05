<template>
    <header class="app-header drag-region">
        <!-- 应用图标（主题自适应） -->
        <AppIcon />
        <!-- 标题 -->
        <span class="title-text">{{ t("app.title") }}</span>
        <!-- 菜单栏 -->
        <nav class="menu-bar">
            <div v-for="menu in menus" :key="menu.label" class="menu-item">
                {{ t(menu.label) }}
            </div>
        </nav>
        <!-- 设置按钮区（no-drag） -->

        <!-- 窗口控制按钮区（no-drag） -->
        <div class="window-controls no-drag-region">
            <a-space class="setting-header no-drag-region">
                <CoffeeOutlined class="system-icon" @click="openScanList"></CoffeeOutlined>
                <ImportOutlined class="system-icon" @click="openImportPhotos"></ImportOutlined>
                <SettingOutlined class="system-icon" @click="openPreference" />
            </a-space>
            <!-- 最小化 -->
            <button
                class="window-btn win-btn minimize"
                @click="minimizeWindow"
                :title="t('window.minimize')"
            >
                <svg class="win-svg" width="12" height="12" viewBox="0 0 12 12">
                    <rect x="2" y="6" width="8" height="1.5" rx="0.75" />
                </svg>
            </button>
            <!-- 最大化/恢复 -->
            <button
                class="window-btn win-btn maximize"
                :title="isMaximized ? t('window.restore') : t('window.maximize')"
                @click="isMaximized ? unmaximizeWindow() : maximizeWindow()"
            >
                <svg v-if="!isMaximized" class="win-svg" width="12" height="12" viewBox="0 0 12 12">
                    <rect
                        x="2.5"
                        y="2.5"
                        width="7"
                        height="7"
                        rx="1"
                        fill="none"
                        stroke-width="1.2"
                    />
                </svg>
                <svg v-else class="win-svg" width="12" height="12" viewBox="0 0 12 12">
                    <rect
                        x="3.5"
                        y="4.5"
                        width="5"
                        height="5"
                        rx="1"
                        fill="none"
                        stroke-width="1.2"
                    />
                    <rect
                        x="5.5"
                        y="2.5"
                        width="5"
                        height="5"
                        rx="1"
                        fill="none"
                        stroke-width="1.2"
                    />
                </svg>
            </button>
            <!-- 关闭 -->
            <button
                class="window-btn win-btn close"
                @click="closeWindow"
                :title="t('window.close')"
            >
                <svg class="win-svg" width="12" height="12" viewBox="0 0 12 12">
                    <line x1="3" y1="3" x2="9" y2="9" stroke-width="1.4" />
                    <line x1="9" y1="3" x2="3" y2="9" stroke-width="1.4" />
                </svg>
            </button>
        </div>
    </header>
</template>

<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import CoffeeOutlined from "@ant-design/icons-vue/CoffeeOutlined";
import ImportOutlined from "@ant-design/icons-vue/ImportOutlined";
import SettingOutlined from "@ant-design/icons-vue/SettingOutlined";
import { useI18n } from "vue-i18n";
import { ref, onMounted, onBeforeUnmount } from "vue";
const { t } = useI18n();

const emit = defineEmits(["openScanList", "openImportPhotos", "openPreference"]);
function openScanList() {
    emit("openScanList");
}
function openImportPhotos() {
    emit("openImportPhotos");
}
function openPreference() {
    emit("openPreference");
}

function minimizeWindow() {
    window.api.minimizeWindow();
}
function maximizeWindow() {
    window.api.maximizeWindow();
}
function unmaximizeWindow() {
    window.api.unmaximizeWindow();
}
function closeWindow() {
    window.api.closeWindow();
}

const isMaximized = ref(false);

onMounted(() => {
    // 监听主进程窗口最大化/还原事件
    window.api.onWindowMaximized(() => {
        isMaximized.value = true;
    });
    window.api.onWindowUnmaximized(() => {
        isMaximized.value = false;
    });
    window.api.onWindowMaximizedState((_e, state) => {
        isMaximized.value = !!state;
    });

    // 初始化时主动请求主进程同步状态
    window.api.queryMaximized();
});
onBeforeUnmount(() => {
    window.api.offWindowMaximized(() => {
        isMaximized.value = true;
    });
    window.api.offWindowUnmaximized(() => {
        isMaximized.value = false;
    });
    window.api.offWindowMaximizedState((_e, state) => {
        isMaximized.value = !!state;
    });
});

const menus = [{ label: "View" }, { label: "Window" }, { label: "Help" }];
</script>

<style scoped lang="less">
.app-header {
    height: var(--photasa-header-height, 36px);
    display: flex;
    align-items: center;
    background: var(--color-bg);
    color: var(--color-text);
    user-select: none;
    -webkit-app-region: drag;
}
.drag-region {
    -webkit-app-region: drag;
}
.no-drag-region {
    -webkit-app-region: no-drag;
}
.title-text {
    font-weight: 600;
    font-size: 1.1em;
    margin: 0 12px 0 0;
    user-select: none;
}
.menu-bar {
    display: flex;
    align-items: center;
    height: 100%;
    margin: 0 16px;
}
.menu-item {
    padding: 0 16px;
    cursor: pointer;
    user-select: none;
    color: var(--color-text);
    transition:
        background 0.2s,
        color 0.2s;
    height: 100%;
    display: flex;
    align-items: center;
    &:hover {
        background: var(--color-primary);
        color: var(--color-white);
    }
}
.window-controls {
    display: flex;
    align-items: center;
    margin-left: auto;
    margin-right: 8px;
}
.win-btn {
    width: 36px;
    height: 28px;
    margin: 0 2px;
    border: none;
    outline: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.18s;
    .win-svg {
        width: 16px;
        height: 16px;
        stroke: var(--color-text);
        fill: none;
        pointer-events: none;
        user-select: none;
        transition: stroke 0.18s;
    }
    &:hover {
        background: var(--color-primary);
        .win-svg {
            stroke: #fff;
        }
    }
    &.close:hover {
        background: #e81123;
        .win-svg {
            stroke: #fff;
        }
    }
}
.setting-header {
    margin-right: 16px;
    display: flex;
    align-items: center;
}
.system-icon {
    height: 1.5rem;
    width: 1.5rem;
}
</style>
