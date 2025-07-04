<script setup lang="ts">
/**
 * 通用骨架屏组件
 * Props:
 * - count: 骨架块总数量
 * - width: 骨架块宽度
 * - height: 骨架块高度
 * - rows: 每行最大骨架块数（如 count=8, rows=4，则渲染2行，每行最多4个）
 * - borderRadius: 圆角
 * - gap: 间距
 * - customClass: 自定义 class
 * - customStyle: 自定义 style
 */
import { computed } from "vue";
const props = defineProps({
    count: { type: Number, default: 8 },
    width: { type: Number, default: 150 },
    height: { type: Number, default: 150 },
    rows: { type: Number, default: 1 },
    borderRadius: { type: Number, default: 12 },
    gap: { type: Number, default: 16 },
    customClass: { type: String, default: "" },
    customStyle: { type: Object, default: () => ({}) },
});
const skeletonRows = computed(() => {
    const arr: number[] = [];
    let remain = props.count;
    while (remain > 0) {
        const rowCount = Math.min(remain, props.rows);
        arr.push(rowCount);
        remain -= rowCount;
    }
    return arr;
});
</script>
<template>
    <div
        class="skeleton-list flex flex-col items-start"
        :class="customClass"
        :style="{ gap: gap + 'px', ...customStyle }"
    >
        <div
            v-for="(rowCount, rowIdx) in skeletonRows"
            :key="rowIdx"
            class="flex"
            :style="{ gap: gap + 'px' }"
        >
            <div
                v-for="colIdx in rowCount"
                :key="`${rowIdx}-${colIdx}`"
                class="skeleton-item animate-pulse bg-gray-200"
                :style="{
                    width: width + 'px',
                    height: height + 'px',
                    borderRadius: borderRadius + 'px',
                }"
            ></div>
        </div>
    </div>
</template>
<style scoped>
.skeleton-item {
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.2s ease-in-out infinite;
}
@keyframes skeleton-loading {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}
</style>
