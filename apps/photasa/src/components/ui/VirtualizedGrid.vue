<script setup lang="ts" generic="T">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";

interface Props<T> {
    /** 按行分组的二维数据 */
    rows: T[][];
    /** 单行高度（不含行间距） */
    rowHeight: number;
    /** 外部滚动容器解析器；提供时不再渲染内部滚动壳 */
    resolveScrollElement?: () => HTMLElement | null;
    /** 无外部滚动容器时的固定高度 */
    containerHeight?: number;
    gap?: number;
    overscan?: number;
    /** 内容区顶部外边距 */
    topMargin?: number;
}

interface Emits {
    (e: "itemClick", rowIndex: number, colIndex: number, item: T): void;
    (e: "itemContextMenu", rowIndex: number, colIndex: number, item: T): void;
}

const props = withDefaults(defineProps<Props<T>>(), {
    containerHeight: 400,
    gap: 16,
    overscan: 4,
    topMargin: 0,
});

const emit = defineEmits<Emits>();

const containerRef = ref<HTMLElement | null>(null);
const usesExternalScroll = computed(() => props.resolveScrollElement !== undefined);

const estimatedRowSize = computed(() => props.rowHeight + props.gap);

/** 与 ScanQueueDialog / VirtualList 一致：静态 options + 闭包读取最新滚动容器 */
const virtualizer = useVirtualizer<HTMLElement, Element>({
    count: 0,
    getScrollElement: () => {
        if (props.resolveScrollElement) {
            return props.resolveScrollElement();
        }
        return containerRef.value;
    },
    estimateSize: () => estimatedRowSize.value,
    overscan: props.overscan,
});

const virtualItems = computed(() => virtualizer.value?.getVirtualItems() ?? []);
const totalSize = computed(() => virtualizer.value?.getTotalSize() ?? 0);

function measure(): void {
    virtualizer.value?.measure();
}

function syncVirtualizer(): void {
    if (!virtualizer.value) {
        return;
    }
    virtualizer.value.options.count = props.rows.length;
    measure();
}

function scrollToRow(
    index: number,
    options?: { align?: "start" | "center" | "end" | "auto"; behavior?: "auto" | "smooth" },
): void {
    virtualizer.value?.scrollToIndex(index, options);
}

function scrollToOffset(
    offset: number,
    options?: { align?: "start" | "center" | "end" | "auto"; behavior?: "auto" | "smooth" },
): void {
    virtualizer.value?.scrollToOffset(offset, options);
}

function handleItemClick(rowIndex: number, colIndex: number, item: T): void {
    emit("itemClick", rowIndex, colIndex, item);
}

function handleItemContextMenu(rowIndex: number, colIndex: number, item: T): void {
    emit("itemContextMenu", rowIndex, colIndex, item);
}

watch(
    () => props.rows.length,
    () => {
        nextTick(() => {
            syncVirtualizer();
        });
    },
    { immediate: true },
);

watch(estimatedRowSize, () => {
    nextTick(() => {
        measure();
    });
});

let resizeObserver: ResizeObserver | null = null;

function attachResizeObserver(scrollElement: HTMLElement): void {
    if (resizeObserver) {
        resizeObserver.disconnect();
    }
    resizeObserver = new ResizeObserver(() => {
        nextTick(() => {
            measure();
        });
    });
    resizeObserver.observe(scrollElement);
}

onMounted(() => {
    nextTick(() => {
        syncVirtualizer();
        const scrollElement = props.resolveScrollElement?.() ?? containerRef.value;
        if (scrollElement) {
            attachResizeObserver(scrollElement);
        }
    });
});

onUnmounted(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
});

defineExpose({
    measure,
    scrollToRow,
    scrollToOffset,
});
</script>

<template>
    <div
        v-if="!usesExternalScroll"
        ref="containerRef"
        class="virtualized-grid"
        :style="{
            height: containerHeight + 'px',
            overflow: 'auto',
        }"
    >
        <div
            :style="{
                height: totalSize + 'px',
                position: 'relative',
                marginTop: topMargin + 'px',
            }"
        >
            <div
                v-for="virtualItem in virtualItems"
                :key="virtualItem.index"
                :style="{
                    position: 'absolute',
                    top: virtualItem.start + 'px',
                    left: 0,
                    width: '100%',
                    height: virtualItem.size + 'px',
                    display: 'flex',
                    gap: gap + 'px',
                    paddingLeft: gap + 'px',
                    paddingRight: gap + 'px',
                }"
            >
                <template v-for="(item, colIndex) in props.rows[virtualItem.index]" :key="colIndex">
                    <div
                        class="grid-item"
                        @click="handleItemClick(virtualItem.index, colIndex, item)"
                        @contextmenu.prevent="
                            handleItemContextMenu(virtualItem.index, colIndex, item)
                        "
                    >
                        <slot
                            name="item"
                            :item="item"
                            :rowIndex="virtualItem.index"
                            :colIndex="colIndex"
                        />
                    </div>
                </template>
            </div>
        </div>
    </div>
    <div
        v-else
        :style="{
            height: totalSize + 'px',
            position: 'relative',
            width: '100%',
            marginTop: topMargin + 'px',
        }"
    >
        <div
            v-for="virtualItem in virtualItems"
            :key="virtualItem.index"
            :style="{
                position: 'absolute',
                top: virtualItem.start + 'px',
                left: 0,
                width: '100%',
                height: virtualItem.size + 'px',
                display: 'flex',
                gap: gap + 'px',
                paddingLeft: gap + 'px',
                paddingRight: gap + 'px',
            }"
        >
            <template v-for="(item, colIndex) in props.rows[virtualItem.index]" :key="colIndex">
                <div
                    class="grid-item"
                    @click="handleItemClick(virtualItem.index, colIndex, item)"
                    @contextmenu.prevent="handleItemContextMenu(virtualItem.index, colIndex, item)"
                >
                    <slot
                        name="item"
                        :item="item"
                        :rowIndex="virtualItem.index"
                        :colIndex="colIndex"
                    />
                </div>
            </template>
        </div>
    </div>
</template>

<style scoped>
.virtualized-grid {
    position: relative;
    width: 100%;
}

.grid-item {
    cursor: pointer;
    transition: transform 0.2s ease;
}

.grid-item:hover {
    transform: scale(1.02);
}

.grid-item:active {
    transform: scale(0.98);
}
</style>
