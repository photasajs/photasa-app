<script setup lang="ts">
import { ref, onMounted } from "vue";
import { themeManager, ThemeMeta } from "@renderer/services/theme-manager";

const themes = ref<ThemeMeta[]>([]);
const currentThemeId = ref<string>("");

// 主题预览色块
function getPreviewStyle(theme: ThemeMeta) {
    return {
        background: theme.colors.background,
        color: theme.colors.text,
        border: `1px solid ${theme.colors.border}`,
        padding: "8px",
        borderRadius: "8px",
        minWidth: "120px",
        minHeight: "48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
        fontSize: "1rem",
    };
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
                <div class="theme-preview" :style="getPreviewStyle(theme)">
                    {{ theme.name }}
                </div>
                <div class="theme-desc">{{ theme.description }}</div>
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
.theme-preview {
    margin-bottom: 8px;
    text-align: center;
    color: var(--color-text);
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
}
.theme-desc {
    font-size: 0.9em;
    color: var(--color-text-secondary);
}
</style>
