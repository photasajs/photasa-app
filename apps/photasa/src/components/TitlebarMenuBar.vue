<template>
    <nav class="menu-bar" ref="menuBarRef" :data-testid="TITLEBAR_TEST_ID.MENU_BAR">
        <div
            v-for="menu in filteredMenus"
            :key="menu.key"
            class="menu-item"
            :data-testid="TITLEBAR_TEST_ID.MENU_ITEM"
            :class="{ active: activeMenuKey === menu.key }"
            @click.stop="onMenuClick(menu.key)"
            @mouseenter="onMenuHover(menu.key)"
        >
            {{ menu.label }}
            <MenuDropdown
                v-if="activeMenuKey === menu.key && menu.items"
                :items="menu.items"
                class="dropdown-root"
                @menu-action="handleTitlebarMenuAction"
            />
        </div>
    </nav>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { onClickOutside } from "@vueuse/core";
import type { MenuItemData } from "@photasa/common";
import { useMenusStore } from "@renderer/stores/menus";
import { useZhangSunWuJi } from "@renderer/composables/useZhangSunWuJi";
import MenuDropdown from "./common/MenuDropdown.vue";
import { TITLEBAR_TEST_ID } from "./titlebar-drag-contract";

const menusStore = useMenusStore();
const { menus } = storeToRefs(menusStore);
const zhangSunWuJi = useZhangSunWuJi();

const activeMenuKey = ref<string | null>(null);
const menuBarRef = ref<HTMLElement | null>(null);

/** 窗口内菜单栏不展示 macOS 专属的 app 菜单（该组仍在系统菜单栏） */
const filteredMenus = computed(() => menus.value.filter((menu) => !menu.isMacOnly));

function onMenuClick(menuKey: string): void {
    activeMenuKey.value = activeMenuKey.value === menuKey ? null : menuKey;
}

function onMenuHover(menuKey: string): void {
    if (activeMenuKey.value !== null) {
        activeMenuKey.value = menuKey;
    }
}

function handleTitlebarMenuAction(item: MenuItemData): void {
    activeMenuKey.value = null;
    zhangSunWuJi.handleMenuAction({
        key: item.key,
        label: item.label,
        shortcut: item.shortcut,
        role: item.role,
        url: item.url,
    });
}

onClickOutside(menuBarRef, () => {
    activeMenuKey.value = null;
});
</script>

<style scoped lang="less">
.menu-bar {
    display: flex;
    align-items: center;
    height: 100%;
    margin: 0 8px;
    position: relative;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    /* RFC 0152: 容器穿透，仅 .menu-item 可点 */
    pointer-events: none;
}

.menu-item {
    padding: 0 12px;
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
    white-space: nowrap;
    flex-shrink: 0;
    pointer-events: auto;

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
</style>
