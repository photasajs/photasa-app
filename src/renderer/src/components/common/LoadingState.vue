<script setup lang="ts">
/**
 * 通用加载状态组件
 * Props:
 * - loadingText: string 加载文案
 * - icon: 可选，自定义 SVG 图标
 * - size: 可选，圆环尺寸
 * 支持 skeleton 插槽（骨架屏上方），icon/文案下方居中
 */
defineProps({
    loadingText: { type: String, default: "加载中..." },
    icon: { type: String, default: "" },
    size: { type: Number, default: 40 },
});
</script>
<template>
    <div class="w-full py-8 select-none flex flex-col">
        <!-- 骨架屏插槽，父组件控制布局 -->
        <slot name="skeleton"></slot>
        <!-- loading spinner/文案在下方，水平居中 -->
        <div class="flex flex-col items-center justify-center mt-6 w-full">
            <slot name="icon">
                <svg :width="size" :height="size" fill="none" viewBox="0 0 40 40">
                    <defs>
                        <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#4f8cff" />
                            <stop offset="100%" stop-color="#00e0ff" />
                        </linearGradient>
                    </defs>
                    <circle
                        cx="20"
                        cy="20"
                        r="16"
                        fill="none"
                        stroke="url(#spinner-gradient)"
                        stroke-width="4"
                        stroke-linecap="round"
                        stroke-dasharray="80 40"
                    >
                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="0 20 20"
                            to="360 20 20"
                            dur="0.9s"
                            repeatCount="indefinite"
                        />
                    </circle>
                </svg>
            </slot>
            <slot>
                <div class="mt-4 text-blue-500 font-semibold text-lg">{{ loadingText }}</div>
            </slot>
        </div>
    </div>
</template>
