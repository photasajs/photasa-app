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
import { isFixedItemIndexInScrollViewport, restoreScrollContainerOffset } from "../tree-scroll";

const LARGE_LIST_LENGTH_DELTA = 100;

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

const resolveItemKey = (index: number): string | number => {
    const item = props.items[index];
    return props.getItemKey(item, index);
};

const estimateItemSize = (index: number): number =>
    props.estimateSize ? props.estimateSize(index) : props.itemHeight;

/** 列表突变前由 BaseTree 调用，保存当前 scrollTop */
let pendingRestoreOffset: number | null = null;

const getScrollOffset = (): number => containerRef.value?.scrollTop ?? 0;

const captureScrollOffset = (): void => {
    pendingRestoreOffset = getScrollOffset();
};

const restoreScrollOffset = (offset?: number): void => {
    const container = containerRef.value;
    if (!container) {
        pendingRestoreOffset = null;
        return;
    }

    const top = offset ?? pendingRestoreOffset ?? 0;
    pendingRestoreOffset = null;
    restoreScrollContainerOffset(container, top, (value) => {
        virtualizer.value.scrollToOffset(value, { align: "start", behavior: "auto" });
    });
};

// 使用 @tanstack/vue-virtual 的 useVirtualizer（响应式 options + 稳定 getItemKey 保持展开时滚动位置）
const virtualizer = useVirtualizer(
    computed(() => ({
        count: props.items.length,
        getScrollElement: () => containerRef.value || null,
        estimateSize: estimateItemSize,
        overscan: props.overscan,
        horizontal: props.horizontal,
        scrollMargin: props.scrollMargin,
        getItemKey: resolveItemKey,
        measureElement: props.enableDynamicSize
            ? (element: Element) => {
                  if (props.horizontal) {
                      return element?.getBoundingClientRect().width ?? props.itemHeight;
                  }
                  return element?.getBoundingClientRect().height ?? props.itemHeight;
              }
            : undefined,
    })),
);

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

/** 固定行高：节点 index 是否已在滚动视口内（无需 scrollToIndex） */
const isIndexVisible = (index: number): boolean => {
    const container = containerRef.value;
    if (!container || index < 0 || index >= props.items.length) {
        return false;
    }

    if (props.enableDynamicSize) {
        const { start, end } = getVisibleRange();
        return index >= start && index <= end;
    }

    return isFixedItemIndexInScrollViewport({
        index,
        itemHeight: props.itemHeight,
        scrollTop: container.scrollTop,
        viewportHeight: container.clientHeight,
    });
};

// 重新测量所有项目（当内容动态变化时使用）
const measureAll = () => {
    virtualizer.value.measure();
};

// items 数量变化后恢复突变前捕获的 scrollTop（须在 TanStack 重排后执行）
watch(
    () => props.items.length,
    (newLength, oldLength) => {
        if (pendingRestoreOffset === null || oldLength === undefined) {
            return;
        }

        const lengthDelta = Math.abs(newLength - oldLength);
        if (lengthDelta > LARGE_LIST_LENGTH_DELTA) {
            pendingRestoreOffset = null;
            nextTick(() => scrollToTop());
            return;
        }

        if (lengthDelta === 0) {
            pendingRestoreOffset = null;
            return;
        }

        const savedOffset = pendingRestoreOffset;
        pendingRestoreOffset = null;
        nextTick(() => restoreScrollOffset(savedOffset));
    },
    { flush: "post" },
);

// 监听容器高度变化，重新测量并保留滚动位置
watch(
    () => props.containerHeight,
    () => {
        const savedOffset = getScrollOffset();
        nextTick(() => {
            measureAll();
            restoreScrollOffset(savedOffset);
        });
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
    getScrollOffset,
    captureScrollOffset,
    restoreScrollOffset,
    getVisibleRange,
    isIndexVisible,
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

/* 滚动条样式 - 使用主题变量 */
.virtual-list-container {
    scrollbar-width: thin;
    scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
}

.virtual-list-container::-webkit-scrollbar {
    width: var(--color-scrollbar-width);
    height: var(--color-scrollbar-width);
}

.virtual-list-container::-webkit-scrollbar-track {
    background: var(--color-scrollbar-track);
    border-radius: var(--color-scrollbar-border-radius);
}

.virtual-list-container::-webkit-scrollbar-track:hover {
    background: var(--color-scrollbar-track-hover);
}

.virtual-list-container::-webkit-scrollbar-thumb {
    background: var(--color-scrollbar-thumb);
    border-radius: var(--color-scrollbar-border-radius);
    transition: all 0.2s ease;
}

.virtual-list-container::-webkit-scrollbar-thumb:hover {
    background: var(--color-scrollbar-thumb-hover);
}

.virtual-list-container::-webkit-scrollbar-thumb:active {
    background: var(--color-scrollbar-thumb-active);
}
</style>
