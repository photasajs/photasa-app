<script setup lang="ts">
/**
 * 通用空状态组件
 * Props:
 * - emptyText: string 空状态文案
 * - icon: 可选，自定义 SVG 图标
 * - buttonText: string 按钮文案
 * - onButtonClick: 点击按钮回调
 * 支持插槽自定义内容
 */

/**
 * 定义组件属性
 */
defineProps({
    emptyText: { type: String, default: "还没有图片呢" },
    icon: { type: String, default: "" },
    buttonText: { type: String, default: "开始导入" },
});
const emit = defineEmits(["buttonClick"]);
function handleClick() {
    emit("buttonClick");
}
</script>
<template>
    <div class="flex flex-col items-center justify-center py-16 select-none">
        <slot name="icon">
            <!-- 友好的图片图标设计，鼓励用户导入图片 -->
            <svg width="80" height="80" fill="none" viewBox="0 0 80 80">
                <!-- 主相机机身 -->
                <rect
                    x="20"
                    y="25"
                    width="40"
                    height="30"
                    rx="6"
                    :fill="'var(--color-empty-icon-bg)'"
                    :stroke="'var(--color-empty-icon-border)'"
                    stroke-width="1"
                />
                <!-- 镜头 -->
                <circle
                    cx="40"
                    cy="40"
                    r="12"
                    :fill="'var(--color-empty-icon-accent)'"
                    :stroke="'var(--color-empty-icon-border)'"
                    stroke-width="1"
                />
                <!-- 镜头中心 -->
                <circle cx="40" cy="40" r="6" :fill="'var(--color-bg)'" />
                <!-- 闪光灯 -->
                <rect
                    x="45"
                    y="20"
                    width="8"
                    height="6"
                    rx="2"
                    :fill="'var(--color-empty-icon-accent)'"
                    :stroke="'var(--color-empty-icon-border)'"
                    stroke-width="0.5"
                />
                <!-- 取景器 -->
                <rect
                    x="30"
                    y="20"
                    width="12"
                    height="8"
                    rx="2"
                    :fill="'var(--color-bg)'"
                    :stroke="'var(--color-empty-icon-border)'"
                    stroke-width="0.5"
                />
                <!-- 友好的装饰元素：表示"欢迎导入图片" -->
                <circle cx="60" cy="20" r="8" :fill="'var(--color-primary)'" opacity="0.8" />
                <path
                    d="M56 20 L60 16 L64 20 M60 16 L60 24"
                    :stroke="'var(--color-white)'"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
                <!-- 温馨的提示点 -->
                <circle cx="15" cy="15" r="3" :fill="'var(--color-success)'" opacity="0.6" />
                <circle cx="65" cy="65" r="2" :fill="'var(--color-warning)'" opacity="0.6" />
            </svg>
        </slot>
        <slot>
            <div class="mt-6 text-lg font-medium" style="color: var(--color-text-secondary)">
                {{ emptyText }}
            </div>
        </slot>
        <template v-if="buttonText">
            <button
                class="mt-6 px-6 py-2 rounded font-semibold shadow"
                style="background: var(--color-primary); color: var(--color-white)"
                @click="handleClick"
            >
                {{ buttonText }}
            </button>
        </template>
    </div>
</template>
