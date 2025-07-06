<template>
    <header class="app-header">
        <a-space class="title-header">
            <a-typography-text type="primary">{{ t("app.title") }}</a-typography-text>
        </a-space>
        <a-space class="setting-header">
            <CoffeeOutlined class="system-icon" @click="openScanList"></CoffeeOutlined>
            <ImportOutlined class="system-icon" @click="openImportPhotos"></ImportOutlined>
            <SettingOutlined class="system-icon" @click="openPreference" />
        </a-space>
    </header>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { onMounted, onUnmounted, watch } from "vue";
import { useMenusStore } from "@renderer/stores/menus";
import type { MenuItemData } from "@common/menu-types";
import CoffeeOutlined from "@ant-design/icons-vue/CoffeeOutlined";
import ImportOutlined from "@ant-design/icons-vue/ImportOutlined";
import SettingOutlined from "@ant-design/icons-vue/SettingOutlined";

const { t } = useI18n();
const emit = defineEmits(["openScanList", "openImportPhotos", "openPreference", "menu-action"]);

function openScanList() {
    emit("openScanList");
}
function openImportPhotos() {
    emit("openImportPhotos");
}
function openPreference() {
    emit("openPreference");
}

// ========== 菜单同步与事件桥接 ========== //
const menusStore = useMenusStore();
const menus = menusStore.menus as MenuItemData[]; // 保证类型一致

// 监听 menus 变化，自动同步到 preload 层
watch(
    () => menusStore.menus,
    (newMenus) => {
        if (window.api?.applySystemMenu) {
            window.api.applySystemMenu(JSON.parse(JSON.stringify(newMenus)));
        }
    },
    { immediate: true, deep: true },
);

// 菜单事件监听句柄
let offMenuAction: (() => void) | null = null;

onMounted(() => {
    // 注册菜单点击事件监听
    if (window.api?.onMenuAction) {
        const handler = (payload: any) => {
            // 收到主进程菜单点击事件，转发到父组件
            emit("menu-action", payload);
        };
        window.api.onMenuAction(handler);
        // 提供移除监听的能力（如有 off 方法）
        offMenuAction = () => {
            if (window.api?.offMenuAction) {
                window.api.offMenuAction(handler);
            }
        };
    }
});

onUnmounted(() => {
    // 组件卸载时移除菜单事件监听
    if (offMenuAction) offMenuAction();
});
</script>

<style lang="less" scoped>
.app-header {
    height: var(--photasa-header-height, 36px);
    margin-left: 36px;
    padding-left: 50px;
    line-height: 36px;
    display: flex;
}
.title-header {
    flex-grow: 1;
    user-select: none;
    -webkit-app-region: drag;
}
.setting-header {
    float: right;
    margin-right: 16px;
    -webkit-app-region: no-drag;
}
.system-icon {
    height: 1.5rem;
    width: 1.5rem;
}
</style>
