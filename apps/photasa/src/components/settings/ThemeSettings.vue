<script setup lang="ts">
/**
 * 主题设置组件 - 阎立本画师
 * 为人界界面提供主题切换功能，实现依赖注入模式
 *
 * 神话背景：
 * 阎立本，唐朝著名画家，以善于绘制人物、风景著称
 * 在Photasa系统中，阎立本化身人界界面画师，负责主题风格设计
 * 通过民间Vue技术，为人界界面提供美观的主题切换功能
 * 与房玄龄宰相协作，确保界面风格与用户偏好保持一致
 *
 * 核心功能：
 * - 主题展示：展示各种可用的界面主题风格
 * - 主题切换：响应用户选择，切换界面主题
 * - 实时预览：提供主题预览功能，让用户提前感受效果
 * - 状态同步：与房玄龄宰相协作，保持主题状态一致
 */
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useChuSuiLiang, type ThemeMeta } from "@renderer/composables/useChuSuiLiang";
import ThemePreviewBox from "./ThemePreviewBox.vue";
import { loggers } from "@photasa/common";
import posthog from "posthog-js";
/**
 * 日志记录器
 */
const logger = loggers.chusuiliang;
/**
 * 褚遂良服务实例 - 偏好设置管理
 */
const chuSuiLiang = useChuSuiLiang();

/**
 * 主题管理器实例
 */
const themeManager = chuSuiLiang.themeManager;

/**
 * 主题列表
 */
const themes = ref<ThemeMeta[]>([]);

/**
 * 国际化实例
 */
const { locale } = useI18n();

/**
 * 阎立本响应Store中的主题变化
 */
const currentThemeId = computed({
    get() {
        return chuSuiLiang.currentTheme;
    },
    set(value: string) {
        chuSuiLiang.currentTheme = value;
    },
});

/**
 * 获取国际化文本
 */
function toLocalizedText(obj: any, fallback = "") {
    if (typeof obj === "string") return obj;
    if (obj && typeof obj === "object") {
        return obj[locale.value] || obj["en-US"] || Object.values(obj)[0] || fallback;
    }
    return fallback;
}

async function switchTheme(themeId: string) {
    try {
        // 阎立本接收用户指令
        logger.info(`🎨 接收主题变更指令 ${themeId}`);

        // 1. 先立即更新UI显示，提供即时反馈
        await themeManager.applyTheme(themeId);

        // 2. 通过褚遂良中书令发送奏折，触发完整通信链路：
        // 阎立本 -> 褚遂良(奏折) -> 房玄龄(转发) -> 袁天罡(诏令) -> 天枢(符箓) -> 文昌(存储)
        await chuSuiLiang.updateTheme(themeId);

        posthog.capture("theme_changed", { theme_id: themeId });

        // 阎立本确认主题更新完成
        logger.info(`🎨 确认主题已更新为 ${currentThemeId.value}`);
    } catch (error) {
        logger.error(`🎨 主题变更失败 ${themeId}`, error);

        // 如果保存失败，可能需要回滚UI状态
        // 这里可以考虑恢复到之前的主题
        logger.warn(`🎨 主题保存失败，UI已更新但可能未同步到天界`);
    }
}

onMounted(async () => {
    try {
        await themeManager.loadBuiltInThemes();
        themes.value = themeManager.getThemes();

        // 阎立本初始化完成，响应Store状态
        logger.info(`🎨 就职完成，当前主题: ${currentThemeId.value}`);
    } catch (error) {
        logger.error("🎨 主题加载失败:", error);
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
                    :name="toLocalizedText(theme.name)"
                    :description="toLocalizedText(theme.description)"
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
