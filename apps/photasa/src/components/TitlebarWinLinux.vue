<template>
    <header class="app-header drag-region" data-tauri-drag-region>
        <!-- 应用图标（主题自适应） -->
        <AppIcon />
        <!-- 标题 -->
        <span class="title-text" data-tauri-drag-region>{{ t("app.title") }}</span>
        <TitlebarMenuBar class="no-drag-region" />
        <!-- 设置按钮区（no-drag） -->

        <!-- 窗口控制按钮区（no-drag） -->
        <div class="window-controls no-drag-region">
            <BaseSpace class="setting-header no-drag-region">
                <CoffeeOutlined class="system-icon" @click="openScanList"></CoffeeOutlined>
                <ImportOutlined class="system-icon" @click="openImportPhotos"></ImportOutlined>
                <ReportIssueOutlined
                    class="system-icon"
                    :title="t('menu.help.reportIssue')"
                    @click="openReportIssueDialog"
                />
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
    PhWarningCircle as ReportIssueOutlined,
} from "@phosphor-icons/vue";
import { useI18n } from "vue-i18n";
import { ref, onMounted, onBeforeUnmount } from "vue";
import { BaseSpace } from "@renderer/components/ui";
import TitlebarMenuBar from "./TitlebarMenuBar.vue";
import { useYuanTianGang } from "@renderer/composables/useYuanTianGang";
import { openReportIssueDialog } from "@renderer/services/report-issue-dialog";
const { t } = useI18n();
const windows = useYuanTianGang().windows;
let windowCleanups: Array<() => void> = [];

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
    void windows.minimize();
}
function maximizeWindow() {
    void windows.maximize();
}
function unmaximizeWindow() {
    void windows.unmaximize();
}
function closeWindow() {
    void windows.closeWindow();
}

const isMaximized = ref(false);

onMounted(async () => {
    windowCleanups = await Promise.all([
        windows.onMaximized(() => {
            isMaximized.value = true;
        }),
        windows.onUnmaximized(() => {
            isMaximized.value = false;
        }),
        windows.onMaximizedState((state) => {
            isMaximized.value = state;
        }),
    ]);
    isMaximized.value = await windows.isMaximized();
});
onBeforeUnmount(() => {
    windowCleanups.forEach((cleanup) => cleanup());
    windowCleanups = [];
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
    transition:
        color 0.15s ease,
        opacity 0.15s ease;
    opacity: 0.85;

    &:hover {
        opacity: 1;
        color: var(--color-primary, #3794ff);
    }
}
</style>
