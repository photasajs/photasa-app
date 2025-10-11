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
    try {
        await themeManager.applyTheme(themeId, "/src/renderer/src/themes");
        currentThemeId.value = themeId;
        console.log(`主题切换成功: ${themeId}`);
    } catch (error) {
        console.error(`主题切换失败: ${themeId}`, error);
    }
}

onMounted(async () => {
    try {
        await themeManager.loadBuiltInThemes();
        themes.value = themeManager.getThemes();
        const cur = themeManager.getCurrentTheme();
        currentThemeId.value = cur?.id || themes.value[0]?.id || "";
        console.log(`当前主题: ${currentThemeId.value}`);
        console.log(
            `可用主题:`,
            themes.value.map((t) => t.id),
        );
    } catch (error) {
        console.error("主题加载失败:", error);
    }
});
</script>

<template>
    <div class="theme-settings settings-container">
        <h2 class="settings-title">主题切换</h2>
        <div class="theme-grid">
            <div
                v-for="theme in themes"
                :key="theme.id"
                class="theme-item"
                :class="{ 'theme-item--active': theme.id === currentThemeId }"
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
    padding: 20px;
    background: var(--color-bg);
    color: var(--color-text);
    min-height: 100%;
}

.settings-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 20px;
    color: var(--color-text);
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 10px;
}

.theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    max-width: 800px;
}

.theme-item {
    cursor: pointer;
    border-radius: 12px;
    border: 2px solid var(--color-border);
    transition: all 0.2s ease;
    padding: 8px;
    background: var(--color-card-bg);
    position: relative;
    overflow: hidden;
}

.theme-item:hover {
    border-color: var(--color-primary);
    background: var(--color-card-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--color-shadow);
}

.theme-item--active {
    border-color: var(--color-primary);
    background: var(--color-card-active);
    box-shadow: 0 0 0 1px var(--color-primary) inset;
}

.theme-item--active::before {
    content: "";
    position: absolute;
    top: 8px;
    right: 8px;
    width: 16px;
    height: 16px;
    background: var(--color-primary);
    border-radius: 50%;
    z-index: 10;
}

.theme-item--active::after {
    content: "✓";
    position: absolute;
    top: 10px;
    right: 10px;
    width: 12px;
    height: 12px;
    color: white;
    font-size: 10px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 11;
}

/* 确保预览框样式不被外部影响 */
.theme-item :deep(*) {
    box-sizing: border-box;
}
</style>
