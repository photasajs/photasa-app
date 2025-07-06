<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { i18nUtils, type Locale } from "../i18n/config";
import { usePreferenceStore } from "@renderer/stores/preference";
import { useMenusStore } from "@renderer/stores/menus";
import { useI18n } from "vue-i18n";

const isOpen = ref(false);
const preferenceStore = usePreferenceStore();
const menusStore = useMenusStore();
const { t } = useI18n();

const toggleDropdown = () => {
    isOpen.value = !isOpen.value;
};

const selectLocale = async (locale: Locale) => {
    preferenceStore.setLocale(locale);
    await nextTick();
    menusStore.refreshMenus(t); // 切换语言后刷新菜单
    isOpen.value = false;
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
        <a-dropdown v-model:open="isOpen" trigger="click">
            <a-button type="text" @click="toggleDropdown" class="locale-button">
                <span class="locale-flag">{{ currentLocaleInfo.flag }}</span>
                <span class="locale-name">{{ currentLocaleInfo.nativeName }}</span>
                <span class="locale-arrow" :class="{ 'is-open': isOpen }">▼</span>
            </a-button>
            <template #overlay>
                <a-menu class="locale-menu">
                    <a-menu-item
                        v-for="locale in availableLocales"
                        :key="locale"
                        @click="selectLocale(locale)"
                        :class="{ active: locale === currentLocale }"
                    >
                        <span class="locale-flag">{{ i18nUtils.getLocaleFlag(locale) }}</span>
                        <span class="locale-name">{{ i18nUtils.getLocaleNativeName(locale) }}</span>
                        <span class="locale-code">{{ locale }}</span>
                    </a-menu-item>
                </a-menu>
            </template>
        </a-dropdown>
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
}

.locale-button:hover {
    background-color: rgba(0, 0, 0, 0.04);
}

.locale-flag {
    font-size: 16px;
}

.locale-name {
    font-size: 14px;
}

.locale-arrow {
    font-size: 10px;
    transition: transform 0.3s ease;
}

.locale-arrow.is-open {
    transform: rotate(180deg);
}

.locale-menu {
    min-width: 160px;
    padding: 4px;
}

:deep(.ant-dropdown-menu-item) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 4px;
    transition: all 0.3s ease;
}

:deep(.ant-dropdown-menu-item:hover) {
    background-color: rgba(0, 0, 0, 0.04);
}

:deep(.ant-dropdown-menu-item.active) {
    background-color: #e6f7ff;
}

.locale-code {
    margin-left: 16px;
    font-size: 12px;
    color: #999;
}

/* Animation for dropdown */
:deep(.ant-dropdown) {
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
