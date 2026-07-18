<template>
    <div ref="host"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, type PropType } from "vue";

interface ThemeColors {
    [key: string]: string;
}

const props = defineProps({
    colors: {
        type: Object as PropType<ThemeColors>,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
});

const host = ref<HTMLElement | null>(null);
let shadow: ShadowRoot | null = null;

// 计算预览框需要的颜色，从主题颜色中映射
const previewColors = computed(() => ({
    background: props.colors.bg || props.colors.background || "#ffffff",
    text: props.colors.text || "#000000",
    border: props.colors.border || "#e7e7e7",
    secondary:
        props.colors["bg-secondary"] ||
        props.colors["bg_secondary"] ||
        props.colors.background ||
        "#f3f3f3",
    primary: props.colors.primary || "#0066b8",
    cardBg:
        props.colors["card-bg"] ||
        props.colors["card_bg"] ||
        props.colors["bg-secondary"] ||
        "#f3f3f3",
}));

function renderShadow() {
    if (!shadow) return;

    // 构建隔离样式，使用计算后的颜色
    const colors = previewColors.value;
    const style = `
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        .preview-container {
            width: 100%;
            min-height: 120px;
            background: ${colors.background};
            border: 2px solid ${colors.border};
            border-radius: 8px;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
        }

        .preview-header {
            background: ${colors.secondary};
            padding: 8px 12px;
            border-bottom: 1px solid ${colors.border};
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .preview-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .dot-red { background: #ff5f57; }
        .dot-yellow { background: #ffbd2e; }
        .dot-green { background: #28ca42; }

        .preview-content {
            flex: 1;
            padding: 12px;
            background: ${colors.background};
            color: ${colors.text};
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
        }

        .preview-title {
            font-size: 14px;
            font-weight: 600;
            color: ${colors.text};
            margin-bottom: 4px;
            line-height: 1.2;
        }

        .preview-desc {
            font-size: 11px;
            color: ${colors.text};
            opacity: 0.7;
            line-height: 1.3;
        }

        .preview-element {
            width: 60%;
            height: 4px;
            background: ${colors.primary};
            border-radius: 2px;
            margin: 8px 0 4px 0;
        }

        .preview-card {
            background: ${colors.cardBg};
            border: 1px solid ${colors.border};
            border-radius: 4px;
            padding: 6px 8px;
            margin-top: 6px;
            width: 80%;
            font-size: 10px;
            color: ${colors.text};
            opacity: 0.8;
        }
    `;

    shadow.innerHTML = `
        <style>${style}</style>
        <div class="preview-container">
            <div class="preview-header">
                <div class="preview-dot dot-red"></div>
                <div class="preview-dot dot-yellow"></div>
                <div class="preview-dot dot-green"></div>
            </div>
            <div class="preview-content">
                <div class="preview-title">${props.name}</div>
                <div class="preview-element"></div>
                <div class="preview-desc">${props.description}</div>
                <div class="preview-card">Preview Card</div>
            </div>
        </div>
    `;
}

onMounted(() => {
    if (host.value) {
        shadow = host.value.attachShadow({ mode: "open" });
        renderShadow();
    }
});

watch(() => [props.colors, props.name, props.description], renderShadow, { deep: true });
</script>
