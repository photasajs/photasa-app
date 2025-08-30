/** * Virtual List Component for Large File Lists */

<template>
    <div
        ref="containerRef"
        class="virtual-list-container"
        :style="{ height: containerHeight + 'px' }"
    >
        <div
            :style="{
                height: totalSize + 'px',
                position: 'relative',
            }"
        >
            <div
                v-for="virtualItem in virtualItems"
                :key="String(virtualItem.key)"
                :data-index="virtualItem.index"
                :ref="
                    (el) =>
                        el &&
                        props.enableDynamicSize &&
                        virtualizer?.measureElement?.(el as Element)
                "
                :style="{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                }"
                class="virtual-list-item"
            >
                <slot
                    :item="props.items[virtualItem.index]"
                    :index="virtualItem.index"
                    :virtualItem="virtualItem"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";

interface VirtualListProps {
    items: any[];
    itemHeight?: number;
    containerHeight: number;
    overscan?: number;
    getItemKey?: (item: any, index: number) => string | number;
    // 新增：动态尺寸支持
    estimateSize?: (index: number) => number;
    // 新增：启用动态尺寸测量
    enableDynamicSize?: boolean;
    // 新增：初始滚动偏移
    initialScrollOffset?: number;
    // 新增：滚动边距
    scrollMargin?: number;
    // 新增：水平虚拟化支持
    horizontal?: boolean;
}

const props = withDefaults(defineProps<VirtualListProps>(), {
    overscan: 5,
    itemHeight: 50,
    enableDynamicSize: false,
    initialScrollOffset: 0,
    scrollMargin: 0,
    horizontal: false,
    getItemKey: (item: any, index: number) => item?.id || item?.path || index,
});

const containerRef = ref<HTMLElement>();

// 使用 @tanstack/vue-virtual 的 useVirtualizer
const virtualizer = useVirtualizer({
    count: props.items.length,
    getScrollElement: () => containerRef.value || null,
    estimateSize: props.estimateSize || (() => props.itemHeight),
    overscan: props.overscan,
    horizontal: props.horizontal,
    initialOffset: props.initialScrollOffset,
    scrollMargin: props.scrollMargin,
    // 启用动态尺寸测量
    measureElement: props.enableDynamicSize
        ? (element) => {
              if (props.horizontal) {
                  return element?.getBoundingClientRect().width ?? props.itemHeight;
              }
              return element?.getBoundingClientRect().height ?? props.itemHeight;
          }
        : undefined,
});

// 虚拟化项目和总尺寸
const virtualItems = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());

// 滚动到顶部方法
const scrollToTop = () => {
    virtualizer.value.scrollToOffset(0, { align: "start" });
};

// 滚动到指定索引
const scrollToIndex = (
    index: number,
    options?: { align?: "start" | "center" | "end" | "auto"; behavior?: "auto" | "smooth" },
) => {
    virtualizer.value.scrollToIndex(index, options);
};

// 滚动到指定偏移
const scrollToOffset = (
    offset: number,
    options?: { align?: "start" | "center" | "end" | "auto"; behavior?: "auto" | "smooth" },
) => {
    virtualizer.value.scrollToOffset(offset, options);
};

// 获取当前可见范围
const getVisibleRange = () => {
    const items = virtualItems.value;
    if (items.length === 0) return { start: 0, end: 0 };
    return {
        start: items[0].index,
        end: items[items.length - 1].index,
    };
};

// 重新测量所有项目（当内容动态变化时使用）
const measureAll = () => {
    virtualizer.value.measure();
};

// 监听项目数量变化，自动重新测量
watch(
    () => props.items.length,
    (newLength, oldLength) => {
        // 更新 virtualizer 的 count
        if (virtualizer.value) {
            virtualizer.value.options.count = newLength;
            virtualizer.value.measure();
        }
        // 如果项目数量大幅变化，滚动到顶部
        if (Math.abs(newLength - oldLength) > 100) {
            nextTick(() => scrollToTop());
        }
    },
);

// 监听容器高度变化，重新测量
watch(
    () => props.containerHeight,
    () => {
        nextTick(() => measureAll());
    },
);

// 监听其他配置变化
watch(
    () => props.overscan,
    (newOverscan) => {
        if (virtualizer.value) {
            virtualizer.value.options.overscan = newOverscan;
            virtualizer.value.measure();
        }
    },
);

watch(
    () => props.horizontal,
    (newHorizontal) => {
        if (virtualizer.value) {
            virtualizer.value.options.horizontal = newHorizontal;
            virtualizer.value.measure();
        }
    },
);

// ResizeObserver 用于监听容器大小变化
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    // 初始滚动位置
    if (props.initialScrollOffset > 0) {
        nextTick(() => {
            scrollToOffset(props.initialScrollOffset);
        });
    }

    // 监听容器大小变化
    if (containerRef.value && props.enableDynamicSize) {
        resizeObserver = new ResizeObserver(() => {
            measureAll();
        });
        resizeObserver.observe(containerRef.value);
    }
});

onUnmounted(() => {
    if (resizeObserver && containerRef.value) {
        resizeObserver.unobserve(containerRef.value);
    }
});

// 暴露方法给父组件
defineExpose({
    scrollToTop,
    scrollToIndex,
    scrollToOffset,
    getVisibleRange,
    measureAll,
    virtualizer: computed(() => virtualizer.value),
});
</script>

<style scoped>
.virtual-list-container {
    overflow: auto;
    contain: strict;
}

.virtual-list-item {
    contain: layout style paint;
    will-change: transform;
}

/* 水平模式支持 */
.virtual-list-container.horizontal {
    overflow-x: auto;
    overflow-y: hidden;
}

.virtual-list-container.horizontal .virtual-list-item {
    display: inline-block;
    vertical-align: top;
}

/* 性能优化 */
.virtual-list-item {
    transform: translateZ(0); /* 启用硬件加速 */
}

/* 滚动条样式 */
.virtual-list-container::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

.virtual-list-container::-webkit-scrollbar-track {
    background: var(--color-bg-secondary, #f1f1f1);
}

.virtual-list-container::-webkit-scrollbar-thumb {
    background: var(--color-border, #c1c1c1);
    border-radius: 4px;
}

.virtual-list-container::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-secondary, #a1a1a1);
}
</style>
