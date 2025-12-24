<script setup lang="ts" generic="T">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";

interface Props<T> {
    items: T[][];
    itemHeight: number;
    containerHeight?: number;
    gap?: number;
    overscan?: number;
}

interface Emits {
    (e: "itemClick", rowIndex: number, colIndex: number, item: T): void;
    (e: "itemContextMenu", rowIndex: number, colIndex: number, item: T): void;
}

const props = withDefaults(defineProps<Props<T>>(), {
    containerHeight: 400,
    gap: 16,
    overscan: 4,
});

const emit = defineEmits<Emits>();

const containerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);

// 虚拟化配置
const virtualizer = useVirtualizer<HTMLElement, Element>({
    count: props.items.length,
    getScrollElement: () => containerRef.value,
    estimateSize: () => props.itemHeight + props.gap,
    overscan: props.overscan,
});

// 虚拟化项目
const virtualItems = computed(() => virtualizer.value?.getVirtualItems() ?? []);
const totalSize = computed(() => virtualizer.value?.getTotalSize() ?? 0);

// 处理容器宽度变化
function updateContainerWidth() {
    if (containerRef.value) {
        containerWidth.value = containerRef.value.clientWidth;
    }
}

// ResizeObserver 用于监听容器大小变化
let resizeObserver: ResizeObserver | null = null;

// 处理项目点击
function handleItemClick(rowIndex: number, colIndex: number, item: T) {
    emit("itemClick", rowIndex, colIndex, item);
}

// 处理项目右键菜单
function handleItemContextMenu(rowIndex: number, colIndex: number, item: T) {
    emit("itemContextMenu", rowIndex, colIndex, item);
}

// 监听项目变化，重新测量
watch(
    () => props.items.length,
    () => {
        if (virtualizer.value) {
            virtualizer.value.options.count = props.items.length;
            virtualizer.value.measure();
        }
    },
);

// 监听容器宽度变化，重新测量
watch(containerWidth, () => {
    if (virtualizer.value) {
        nextTick(() => {
            virtualizer.value.measure();
        });
    }
});

onMounted(() => {
    updateContainerWidth();

    // 监听窗口大小变化
    window.addEventListener("resize", updateContainerWidth);

    // 使用 ResizeObserver 监听容器大小变化
    if (containerRef.value) {
        resizeObserver = new ResizeObserver(() => {
            updateContainerWidth();
        });
        resizeObserver.observe(containerRef.value);
    }
});

onUnmounted(() => {
    window.removeEventListener("resize", updateContainerWidth);
    if (resizeObserver && containerRef.value) {
        resizeObserver.unobserve(containerRef.value);
    }
});
</script>

<template>
    <div
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
                <template
                    v-for="(item, colIndex) in props.items[virtualItem.index]"
                    :key="colIndex"
                >
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
