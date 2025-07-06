<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { themeManager, ThemeMeta } from "@renderer/services/theme-manager";
import ThemePreviewBox from "./ThemePreviewBox.vue";

const themes = ref<ThemeMeta[]>([]);
const currentThemeId = ref<string>("");
const { locale } = useI18n();

function getI18nText(obj: any, fallback = "") {
    if (typeof obj === "string") return obj;
    if (obj && typeof obj === "object") {
        return obj[locale.value] || obj["en-US"] || Object.values(obj)[0] || fallback;
    }
    return fallback;
}

async function switchTheme(themeId: string) {
    await themeManager.applyTheme(themeId, "/src/renderer/src/themes");
    currentThemeId.value = themeId;
}

onMounted(async () => {
    await themeManager.loadBuiltInThemes();
    themes.value = themeManager.getThemes();
    const cur = themeManager.getCurrentTheme();
    currentThemeId.value = cur?.id || themes.value[0]?.id || "";
});
</script>

<template>
    <div class="theme-settings">
        <h2>主题切换</h2>
        <div class="theme-list">
            <div
                v-for="theme in themes"
                :key="theme.id"
                class="theme-item"
                :class="{ active: theme.id === currentThemeId }"
                @click="switchTheme(theme.id)"
            >
                <ThemePreviewBox
                    :colors="theme.colors"
                    :name="getI18nText(theme.name)"
                    :description="getI18nText(theme.description)"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
.theme-settings {
    padding: 16px;
    background: var(--color-bg);
}
.theme-list {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
}
.theme-item {
    cursor: pointer;
    border-radius: 8px;
    border: 2px solid transparent;
    transition: border 0.2s;
    padding: 8px;
    min-width: 140px;
    max-width: 200px;
    background: var(--color-bg-secondary);
}
.theme-item.active {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary) inset;
}
</style>
