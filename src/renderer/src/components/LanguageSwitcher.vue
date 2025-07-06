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
        name: i18nUtils.getLocaleName(locale),
        nativeName: i18nUtils.getLocaleNativeName(locale),
        flag: i18nUtils.getLocaleFlag(locale),
    };
});
</script>

<template>
    <div class="language-switcher">
        <Menu as="div" class="relative inline-block text-left">
            <MenuButton class="locale-button">
                <span class="locale-flag">{{ currentLocaleInfo.flag }}</span>
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
                            <span class="locale-flag">{{ i18nUtils.getLocaleFlag(locale) }}</span>
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
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.3s ease;
    background: transparent;
    border: none;
    color: var(--color-text);
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
}

.locale-button:hover {
    background-color: var(--color-card-hover);
}

.locale-button:focus {
    outline: none;
    background-color: var(--color-card-hover);
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
    white-space: nowrap;
    flex-shrink: 0;
}

.locale-arrow {
    font-size: 10px;
    transition: transform 0.3s ease;
}

.locale-arrow.is-open {
    transform: rotate(180deg);
}

.locale-dropdown-menu {
    position: absolute;
    left: 0;
    z-index: 10;
    margin-top: 8px;
    min-width: 200px;
    padding: 4px;
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    box-shadow: 0 6px 16px 0 var(--color-shadow);
}

.locale-dropdown-menu:focus {
    outline: none;
}

.locale-dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 4px;
    transition: all 0.3s ease;
    cursor: pointer;
    width: 100%;
    text-align: left;
    border: none;
    background: transparent;
    color: var(--color-text);
    font-family: inherit;
    font-size: inherit;
    white-space: nowrap;
}

.locale-dropdown-item:focus {
    outline: none;
}

.locale-dropdown-item-active {
    background-color: var(--color-card-hover);
    color: var(--color-text);
}

.locale-dropdown-item-selected {
    background-color: var(--color-card-active);
    color: var(--color-text);
}

.locale-code {
    margin-left: auto;
    font-size: 12px;
    color: var(--color-text-secondary);
    white-space: nowrap;
    flex-shrink: 0;
}

/* Animation for dropdown */
:deep(.locale-dropdown-menu) {
    animation: slideDown 0.3s ease;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
