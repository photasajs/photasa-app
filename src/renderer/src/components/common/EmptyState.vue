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
import { defineProps, defineEmits } from "vue";

/**
 * 定义组件属性
 */
defineProps({
    emptyText: { type: String, default: "暂无数据" },
    icon: { type: String, default: "" },
    buttonText: { type: String, default: "" },
});
const emit = defineEmits(["buttonClick"]);
function handleClick() {
    emit("buttonClick");
}
</script>
<template>
    <div class="flex flex-col items-center justify-center py-16 select-none">
        <slot name="icon">
            <svg width="80" height="80" fill="none" viewBox="0 0 80 80">
                <rect x="8" y="20" width="64" height="40" rx="8" fill="#e5e7eb" />
                <rect x="20" y="32" width="16" height="16" rx="4" fill="#b6c2d1" />
                <rect x="44" y="36" width="20" height="12" rx="3" fill="#cfe2f3" />
                <circle cx="28" cy="40" r="4" fill="#fff" />
            </svg>
        </slot>
        <slot>
            <div class="mt-6 text-gray-400 text-lg font-medium">{{ emptyText }}</div>
        </slot>
        <template v-if="buttonText">
            <button
                class="mt-6 px-6 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white font-semibold shadow"
                @click="handleClick"
            >
                {{ buttonText }}
            </button>
        </template>
    </div>
</template>
