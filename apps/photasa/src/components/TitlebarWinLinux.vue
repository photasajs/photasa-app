<template>
    <header class="app-header drag-region" data-tauri-drag-region>
        <!-- 应用图标（主题自适应） -->
        <AppIcon />
        <!-- 标题 -->
        <span class="title-text" data-tauri-drag-region>{{ t("app.title") }}</span>
        <!-- 菜单栏（横向一级菜单） -->
        <nav class="menu-bar no-drag-region" ref="menuBarRef">
            <div
                v-for="menu in filteredMenus"
                :key="menu.key"
                class="menu-item no-drag-region"
                :class="{ active: activeMenuKey === menu.key }"
                @click.stop="onMenuClick(menu.key)"
                @mouseenter="onMenuHover(menu.key)"
            >
                {{ menu.label }}
                <!-- 下拉子菜单，仅当前激活菜单显示 -->
                <MenuDropdown
                    v-if="activeMenuKey === menu.key && menu.items"
                    :items="menu.items"
                    class="dropdown-root"
                    @menu-action="activeMenuKey = null"
                />
            </div>
        </nav>
        <!-- 设置按钮区（no-drag） -->

        <!-- 窗口控制按钮区（no-drag） -->
        <div class="window-controls no-drag-region">
            <BaseSpace class="setting-header no-drag-region">
                <CoffeeOutlined class="system-icon" @click="openScanList"></CoffeeOutlined>
                <DashboardOutlined
                    class="system-icon"
                    @click="openQueueDashboard"
                ></DashboardOutlined>
                <ImportOutlined class="system-icon" @click="openImportPhotos"></ImportOutlined>
                <SettingOutlined class="system-icon" @click="openPreference" />
            </BaseSpace>
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
import {
    PhClock as CoffeeOutlined,
    PhFolder as ImportOutlined,
    PhGear as SettingOutlined,
    PhChartLineUp as DashboardOutlined,
} from "@phosphor-icons/vue";
import { useI18n } from "vue-i18n";
import { onClickOutside } from "@vueuse/core";
import { ref, onMounted, onBeforeUnmount, computed } from "vue";
import { storeToRefs } from "pinia";
import { useMenusStore } from "@renderer/stores/menus";
import { BaseSpace } from "@renderer/components/ui";
import MenuDropdown from "./common/MenuDropdown.vue";
import { getPhotasaApi } from "@renderer/ipc/api-access";
const { t } = useI18n();
const photasaApi = getPhotasaApi();

const emit = defineEmits([
    "openScanList",
    "openQueueDashboard",
    "openImportPhotos",
    "openPreference",
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

function minimizeWindow() {
    photasaApi.minimizeWindow();
}
function maximizeWindow() {
    photasaApi.maximizeWindow();
}
function unmaximizeWindow() {
    photasaApi.unmaximizeWindow();
}
function closeWindow() {
    photasaApi.closeWindow();
}

const isMaximized = ref(false);

onMounted(() => {
    // 监听主进程窗口最大化/还原事件
    photasaApi.onWindowMaximized(() => {
        isMaximized.value = true;
    });

    // 监听主进程窗口还原事件
    photasaApi.onWindowUnmaximized(() => {
        isMaximized.value = false;
    });

    // 监听主进程窗口最大化状态
    photasaApi.onWindowMaximizedState((_e, state) => {
        isMaximized.value = !!state;
    });
    // 初始化时主动请求主进程同步状态
    photasaApi.queryMaximized();
});
onBeforeUnmount(() => {
    photasaApi.offWindowMaximized(() => {
        isMaximized.value = true;
    });
    photasaApi.offWindowUnmaximized(() => {
        isMaximized.value = false;
    });
    photasaApi.offWindowMaximizedState((_e, state) => {
        isMaximized.value = !!state;
    });
});

// menus store 响应式菜单栏
const menusStore = useMenusStore();
const { menus } = storeToRefs(menusStore);

// 当前激活的一级菜单 key，决定 dropdown 是否显示及内容
const activeMenuKey = ref<string | null>(null);
// 一级菜单栏 ref
const menuBarRef = ref<HTMLElement | null>(null);

const filteredMenus = computed(() => menus.value.filter((menu) => !menu.isMacOnly));

// 点击一级菜单按钮，切换下拉菜单显示/隐藏
// 若已激活则关闭，否则激活并显示对应 dropdown
function onMenuClick(menuKey: string) {
    activeMenuKey.value = activeMenuKey.value === menuKey ? null : menuKey;
}
// 主菜单项 hover 时，仅在 dropdown 已打开时切换 activeMenuKey，实现“点击后 hover 切换内容”
function onMenuHover(menuKey: string) {
    if (activeMenuKey.value !== null) {
        activeMenuKey.value = menuKey;
    }
}
// 点击菜单栏外部关闭所有下拉菜单
onClickOutside(menuBarRef, () => {
    activeMenuKey.value = null;
});
</script>

<style scoped lang="less">
.app-header {
    height: var(--photasa-header-height, 36px);
    display: flex;
    align-items: center;
    background: var(--color-header-bg, var(--color-bg));
    color: var(--color-header-text, var(--color-text));
    border-bottom: 1px solid var(--color-header-border, var(--color-border));
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
    position: relative;
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
    position: relative;
    &:hover {
        background: var(--color-primary);
        color: var(--color-white);
    }
    &.active {
        background: var(--color-primary);
        color: var(--color-white);
    }
    .dropdown-root {
        position: absolute;
        left: 0;
        top: 100%;
        z-index: 9999;
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
            stroke: var(--color-white);
        }
    }
    &.close:hover {
        background: var(--color-danger);
        .win-svg {
            stroke: var(--color-white);
        }
    }
}
.setting-header {
    margin-right: 16px;
    display: flex;
    align-items: center;
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
