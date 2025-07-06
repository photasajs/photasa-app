<template>
    <ul class="menu-dropdown-list">
        <template v-for="item in items" :key="item.key">
            <!-- 分隔线 -->
            <li v-if="item.role === 'separator'" class="menu-separator" />
            <!-- 普通菜单项 -->
            <li
                v-else
                :class="[
                    'menu-dropdown-item',
                    { disabled: item.disabled, hasSubmenu: !!item.items },
                ]"
                @click="!item.disabled && !item.items && handleClick(item)"
                @mouseenter="onHover(item)"
                @mouseleave="onHover(null)"
            >
                <span class="menu-label">{{ item.label }}</span>
                <span v-if="item.shortcut" class="menu-shortcut">{{ item.shortcut }}</span>
                <!-- 子菜单递归 -->
                <MenuDropdown
                    v-if="item.items && hoverItem === item"
                    :items="item.items"
                    class="submenu-dropdown"
                    @menu-action="handleClick"
                />
                <span v-if="item.items" class="submenu-arrow">▶</span>
            </li>
        </template>
    </ul>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { MenuItemData } from "@common/menu-types";
const props = defineProps<{ items: MenuItemData[] }>();
const emit = defineEmits(["menu-action"]);
const hoverItem = ref<MenuItemData | null>(null);
function handleClick(item: MenuItemData) {
    emit("menu-action", item);
}
function onHover(item: MenuItemData | null) {
    hoverItem.value = item;
}
</script>

<style scoped lang="less">
.menu-dropdown-list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    min-width: 180px;
    background: var(--color-bg);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border-radius: 4px;
    z-index: 9999;
    position: absolute;
}
.menu-dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 20px 6px 16px;
    cursor: pointer;
    color: var(--color-text);
    white-space: nowrap;
    transition:
        background 0.18s,
        color 0.18s;
    position: relative;
    &:hover:not(.disabled) {
        background: var(--color-primary);
        color: #fff;
    }
    &.disabled {
        color: var(--color-disabled, #aaa);
        cursor: not-allowed;
        background: none;
    }
    &.hasSubmenu {
        padding-right: 32px;
    }
}
.menu-shortcut {
    margin-left: 24px;
    color: var(--color-secondary, #888);
    font-size: 0.95em;
}
.menu-separator {
    height: 1px;
    background: var(--color-border, #e0e0e0);
    margin: 4px 0;
    border: none;
}
.submenu-dropdown {
    left: 100%;
    top: 0;
    position: absolute;
    min-width: 180px;
    z-index: 10000;
}
.submenu-arrow {
    position: absolute;
    right: 8px;
    color: var(--color-secondary, #888);
}
</style>
