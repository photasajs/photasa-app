<script setup lang="ts">
import { computed, nextTick } from "vue";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/vue";
import { i18nUtils, type Locale } from "../i18n/config";
import { usePreferenceStore } from "@renderer/stores/preference";
import { useMenusStore } from "@renderer/stores/menus";
import { useI18n } from "vue-i18n";

const preferenceStore = usePreferenceStore();
const menusStore = useMenusStore();
const { t } = useI18n();

const selectLocale = async (locale: Locale) => {
    preferenceStore.setLocale(locale);
    await nextTick();
    menusStore.refreshMenus(t); // 切换语言后刷新菜单
};

const currentLocale = computed(() => i18nUtils.getCurrentLocale());
const availableLocales = i18nUtils.getAvailableLocales();

// Computed properties for current locale info
const currentLocaleInfo = computed(() => {
    const locale = currentLocale.value;
    if (!i18nUtils.isLocaleSupported(locale)) {
        return {
            name: "Unknown",
            nativeName: "Unknown",
            flag: "🏳️",
        };
    }
    return {
        locale,
        name: i18nUtils.getLocaleName(locale),
        nativeName: i18nUtils.getLocaleNativeName(locale),
    };
});
</script>

<template>
    <div class="language-switcher">
        <Menu as="div" class="relative inline-block text-left">
            <MenuButton class="locale-button">
                <span class="locale-name">{{ currentLocaleInfo.nativeName }}</span>
                <span class="locale-arrow">▼</span>
            </MenuButton>

            <transition
                enter-active-class="transition duration-100 ease-out"
                enter-from-class="transform scale-95 opacity-0"
                enter-to-class="transform scale-100 opacity-100"
                leave-active-class="transition duration-75 ease-in"
                leave-from-class="transform scale-100 opacity-100"
                leave-to-class="transform scale-95 opacity-0"
            >
                <MenuItems class="locale-dropdown-menu">
                    <MenuItem v-for="locale in availableLocales" :key="locale" v-slot="{ active }">
                        <button
                            @click="selectLocale(locale)"
                            :class="[
                                'locale-dropdown-item',
                                {
                                    'locale-dropdown-item-active': active,
                                    'locale-dropdown-item-selected': locale === currentLocale,
                                },
                            ]"
                        >
                            <span class="locale-name">{{
                                i18nUtils.getLocaleNativeName(locale)
                            }}</span>
                            <span class="locale-code">{{ locale }}</span>
                        </button>
                    </MenuItem>
                </MenuItems>
            </transition>
        </Menu>
    </div>
</template>

<style scoped>
.language-switcher {
    display: inline-block;
}

.locale-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    transition: all 0.2s ease;
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
    box-shadow: 0 1px 3px var(--color-shadow);
}

.locale-button:hover {
    background-color: var(--color-card-hover);
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px var(--color-shadow);
    transform: translateY(-1px);
}

.locale-button:focus {
    outline: none;
    background-color: var(--color-card-hover);
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary);
}

.locale-button:active {
    transform: translateY(0);
    box-shadow: 0 1px 3px var(--color-shadow);
}

.locale-flag {
    font-size: 16px;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
}

.locale-name {
    margin-left: 4px;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
}

.locale-arrow {
    font-size: 10px;
    transition: transform 0.2s ease;
    margin-left: 4px;
    color: var(--color-text-secondary);
}

.locale-arrow.is-open {
    transform: rotate(180deg);
}

.locale-dropdown-menu {
    position: absolute;
    left: 0;
    z-index: 1000; /* 提高层级，防止被遮挡 */
    margin-top: 4px;
    min-width: 220px;
    padding: 6px;
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 8px 24px 0 var(--color-shadow);
    backdrop-filter: blur(8px);
    max-height: 320px; /* 限制最大高度 */
    overflow-y: auto; /* 超出时显示滚动条 */
}

.locale-dropdown-menu:focus {
    outline: none;
}

.locale-dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 6px;
    transition: all 0.15s ease;
    cursor: pointer;
    width: 100%;
    text-align: left;
    border: none;
    background: transparent;
    color: var(--color-text);
    font-family: inherit;
    font-size: 14px;
    white-space: nowrap;
    position: relative;
}

.locale-dropdown-item:focus {
    outline: none;
}

.locale-dropdown-item:hover {
    background-color: var(--color-card-hover);
    transform: translateX(2px);
}

.locale-dropdown-item-active {
    background-color: var(--color-primary);
    color: white;
    box-shadow: 0 2px 8px rgba(var(--color-primary-rgb, 0, 102, 184), 0.3);
    transform: translateX(4px);
}

.locale-dropdown-item-active .locale-code {
    color: rgba(255, 255, 255, 0.8);
}

.locale-dropdown-item-active .locale-flag {
    filter: brightness(1.2);
}

.locale-dropdown-item-selected {
    background-color: var(--color-card-active);
    color: var(--color-text);
    border-left: 3px solid var(--color-primary);
    padding-left: 9px;
    padding-right: 32px;
}

.locale-dropdown-item-selected::after {
    content: "✓";
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-primary);
    font-weight: bold;
    font-size: 12px;
    z-index: 1;
}

.locale-code {
    margin-left: auto;
    font-size: 11px;
    color: var(--color-text-secondary);
    white-space: nowrap;
    flex-shrink: 0;
    font-weight: 400;
    opacity: 0.8;
    margin-right: 4px;
}

.locale-dropdown-item-selected .locale-code {
    margin-right: 20px;
}

/* Animation for dropdown */
:deep(.locale-dropdown-menu) {
    animation: slideDown 0.2s ease;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-8px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

/* 增强视觉层次 */
.locale-dropdown-item .locale-flag {
    transition: all 0.15s ease;
}

.locale-dropdown-item:hover .locale-flag {
    transform: scale(1.1);
}

.locale-dropdown-item .locale-name {
    font-weight: 500;
    transition: all 0.15s ease;
}

.locale-dropdown-item-active .locale-name {
    font-weight: 600;
}
</style>
