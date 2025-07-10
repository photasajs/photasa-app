<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { storeToRefs } from "pinia";
import { getImageType, getPhotasaConfig } from "@renderer/utils/api";
import { trim } from "radash";
import type { ImageTypeResult } from "image-type";
import { JsonTreeView } from "json-tree-view-vue3";
import {
    type Card,
    type Image,
    type ImageMeta,
    removeFileProtocol,
    toImageMeta,
    groupImagesByColumns,
} from "@renderer/common/image";
import * as R from "ramda";
import { useI18n } from "vue-i18n";
import { openInFinder } from "@renderer/utils/api-path";
import LazyImage from "./LazyImage.vue";
import ImageFallback from "@renderer/assets/images/fallback.png";
import { useVirtualizer } from "@tanstack/vue-virtual";
import MediaPreview from "./MediaPreview.vue";
import LoadingState from "./common/LoadingState.vue";
import EmptyState from "./common/EmptyState.vue";
import { computeColumns, requestThumbnail, toImageList } from "./ImageListHelper";

// 国际化
const { t } = useI18n();
// 偏好设置
const preferenceStore = usePreferenceStore();
// 偏好设置的引用
const { thumbnailSize, currentFolder, currentFolderConfig } = storeToRefs(preferenceStore);
// 显示图片元数据
const showInfo = ref(false);
// 加载图片元数据
const loadingInfo = ref(false);
// 加载配置
const loadingPhotasaConfig = ref(false);
// 图片加载失败
const fallback = ref(ImageFallback);
// 图片列表的引用
const imageListRef = ref<HTMLElement | null>(null);
// 容器宽度
const containerWidth = ref(0);
// 鼠标悬停延迟
const mouseEnterDelay = ref(1.5);
// 预览是否可见
const previewVisible = ref(false);
// 预览索引
const previewIndex = ref(0);

// 卡片
const card = computed<Card>(() => {
    return toImageList(currentFolder.value, currentFolderConfig.value);
});

// 图片元数据
const imageMeta = reactive<ImageMeta>({
    imageType: {} as ImageTypeResult,
    tags: {},
    path: "",
    maxDepth: 3,
    json: "",
});

// 重建缩略图
async function rebuildThumbnail(image: Image) {
    await requestThumbnail(image, thumbnailSize.value);
}

// 打开图片元数据
async function openImageMeta(image: Image): Promise<void> {
    showInfo.value = true;
    // 等待加载图片元数据
    loadingInfo.value = true;
    const path = `${trim(image.raw, "file:/")}`;
    const info = await getImageType(path);

    imageMeta.imageType = info.imageType ?? {};
    imageMeta.json = JSON.stringify(info.tags ?? {});
    imageMeta.tags = info.tags ?? {};
    imageMeta.path = path;

    // 加载完成
    loadingInfo.value = false;
}

// 打开文件夹
function openFileInFolder(image: Image): void {
    const path = removeFileProtocol(image.raw);
    openInFinder(path);
}

// 更新容器宽度
function updateContainerWidth() {
    if (imageListRef.value) {
        containerWidth.value = imageListRef.value.clientWidth;
    }
}

// 列数
const columns = computed((): number => {
    return computeColumns(containerWidth.value, thumbnailSize.value);
});

// 行数
const rows = computed((): Image[][] => {
    return groupImagesByColumns(card.value?.images || [], columns.value);
});

// 行高
const rowHeight = computed(() => thumbnailSize.value + 16);
// 虚拟滚动
const virtualizer = useVirtualizer<HTMLElement, Element>({
    count: rows.value.length,
    getScrollElement: () => imageListRef.value,
    estimateSize: () => rowHeight.value,
    overscan: 4,
});

// 虚拟滚动行
const virtualRows = computed(() => virtualizer.value?.getVirtualItems() ?? []);

// 虚拟滚动高度
const virtualizerHeight = computed(() => (virtualizer.value?.getTotalSize() ?? 0) + "px");

// 预览图片
const previewImages = computed(() => {
    return R.map(toImageMeta, card.value.images);
});

// 监听容器宽度变化
let resizeObserver: ResizeObserver | null = null;

// 打开预览
function openPreview(rowIdx, colIdx) {
    const idx = rowIdx * columns.value + colIdx;
    previewIndex.value = idx;
    previewVisible.value = true;
}

// 监听容器宽度变化
watch(imageListRef, () => updateContainerWidth());
// 监听缩略图大小变化
watch(thumbnailSize, () => updateContainerWidth());

// 监听当前文件夹变化
watch(currentFolder, async (newVal) => {
    if (newVal) {
        loadingPhotasaConfig.value = true;
        const minDelay = (ms: number) => new Promise((res) => setTimeout(res, ms));
        const [config] = await Promise.all([getPhotasaConfig(currentFolder.value), minDelay(400)]);
        currentFolderConfig.value = config;
        loadingPhotasaConfig.value = false;
    }
});

// 监听行数变化
watch(rows, () => {
    if (virtualizer.value) {
        virtualizer.value.options.count = rows.value.length;
        virtualizer.value.measure();
    }
});

// 监听容器宽度变化
watch(containerWidth, () => {
    if (virtualizer.value) {
        virtualizer.value.measure();
    }
});

// 挂载
onMounted(() => {
    updateContainerWidth();
    window.addEventListener("resize", () => {
        updateContainerWidth();
        if (virtualizer.value) {
            virtualizer.value.measure();
        }
    });
    // 使用 ResizeObserver 监听容器宽度变化
    if (imageListRef.value) {
        resizeObserver = new ResizeObserver(() => {
            updateContainerWidth();
        });
        resizeObserver.observe(imageListRef.value);
    }
});

onUnmounted(() => {
    window.removeEventListener("resize", updateContainerWidth);
    if (resizeObserver && imageListRef.value) {
        resizeObserver.unobserve(imageListRef.value);
    }
});

// 假设 thumbnailSize、containerWidth、gap 可用
// const gap = 16;
// const skeletonRows = computed(() => {
//     // 计算每行图片数，最少为1
//     return Math.max(1, Math.floor((containerWidth.value || 800) / (thumbnailSize.value + gap)));
// });
// const skeletonCount = computed(() => skeletonRows.value * 2); // 默认2行
</script>

<template>
    <div
        class="flex flex-col h-full min-h-0 rounded-lg shadow border"
        style="background: var(--color-card-bg); border-color: var(--color-card-border)"
    >
        <!-- 标题区 -->
        <div
            class="px-4 py-2 border-b flex items-center"
            style="border-color: var(--color-border); background: var(--color-bg-secondary)"
        >
            <a-breadcrumb>
                <a-breadcrumb-item v-for="part in card.parts" :key="part">{{
                    part
                }}</a-breadcrumb-item>
            </a-breadcrumb>
        </div>
        <!-- 内容区 -->
        <div
            ref="imageListRef"
            class="flex-1 min-h-0 overflow-auto image-list relative"
            style="background: var(--color-card-bg)"
        >
            <!-- 空状态：集成通用 EmptyState 组件 -->
            <template v-if="!loadingPhotasaConfig && rows.length === 0">
                <EmptyState
                    :emptyText="t('empty.image')"
                    :buttonText="t('empty.importBtn')"
                    @buttonClick="$emit('import')"
                />
            </template>
            <!-- 加载状态：集成骨架屏+LoadingState 组件 -->
            <div
                v-else-if="loadingPhotasaConfig"
                class="absolute inset-0 z-30 transition-opacity duration-300 rounded-lg shadow-lg pointer-events-auto"
                style="backdrop-filter: blur(2px); background: var(--color-bg-secondary)"
            >
                <LoadingState />
            </div>
            <!-- 虚拟滚动渲染图片行 -->
            <div v-else style="position: relative; width: 100%; height: 100%">
                <div
                    :style="{
                        height: virtualizerHeight,
                        position: 'relative',
                        marginTop: '16px',
                    }"
                >
                    <div
                        v-for="row in virtualRows"
                        :key="row.index"
                        :style="{
                            position: 'absolute',
                            top: row.start + 'px',
                            left: 0,
                            width: '100%',
                            height: row.size + 'px',
                            display: 'flex',
                            gap: '16px',
                            marginBottom: '16px', // 行间距
                        }"
                    >
                        <div class="px-4 w-full flex" style="gap: 16px; max-width: 100%">
                            <template v-for="(image, colIndex) in rows[row.index]" :key="image.key">
                                <div @click="openPreview(row.index, colIndex)">
                                    <a-dropdown :trigger="['contextmenu']">
                                        <a-tooltip
                                            placement="rightBottom"
                                            :mouse-enter-delay="mouseEnterDelay"
                                            :title="image.raw"
                                        >
                                            <a-card
                                                hoverable
                                                :style="{
                                                    height: thumbnailSize + 'px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: 'var(--color-image-item-bg)', // 独立图片项背景色，支持主题
                                                }"
                                            >
                                                <LazyImage
                                                    :width="thumbnailSize"
                                                    :height="thumbnailSize"
                                                    :src="image.thumbnail"
                                                    :fallback="fallback"
                                                    :raw="image.raw"
                                                    :is-video="image.isVideo"
                                                />
                                            </a-card>
                                        </a-tooltip>
                                        <template #overlay>
                                            <a-menu>
                                                <a-menu-item
                                                    key="1"
                                                    @click="openImageMeta(image)"
                                                    >{{ t("menu.getInfo") }}</a-menu-item
                                                >
                                                <a-menu-item
                                                    key="1"
                                                    @click="rebuildThumbnail(image)"
                                                    >{{ t("menu.rebuildThumbnail") }}</a-menu-item
                                                >
                                                <a-menu-item
                                                    key="2"
                                                    @click="openFileInFolder(image)"
                                                    >{{ t("menu.open") }}</a-menu-item
                                                >
                                            </a-menu>
                                        </template>
                                    </a-dropdown>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <a-drawer
        v-model:visible="showInfo"
        class="custom-class"
        style="color: red"
        title="Basic Drawer"
        placement="right"
    >
        <a-spin :spinning="loadingInfo">
            <a-descriptions title="Image Ider" layout="vertical" bordered :column="2">
                <a-descriptions-item label="Image Width">{{
                    imageMeta.tags?.["Image Width"]?.value
                }}</a-descriptions-item>
                <a-descriptions-item label="Image Height">{{
                    imageMeta.tags?.["Image Height"]?.value
                }}</a-descriptions-item>
                <a-descriptions-item label="MIME Type">
                    {{
                        typeof imageMeta.imageType === "object" && imageMeta.imageType
                            ? imageMeta.imageType.mime
                            : ""
                    }}
                </a-descriptions-item>
                <a-descriptions-item label="MIME Type">
                    {{
                        typeof imageMeta.imageType === "object" && imageMeta.imageType
                            ? imageMeta.imageType.ext
                            : ""
                    }}
                </a-descriptions-item>
                <a-descriptions-item label="Location" :span="2">{{
                    imageMeta.path
                }}</a-descriptions-item>
                <a-descriptions-item label="Status" :span="2">
                    <a-layout :style="{ height: '100%', width: '265px', overflow: 'auto' }">
                        <JsonTreeView :data="imageMeta.json" :max-depth="imageMeta.maxDepth" />
                    </a-layout>
                </a-descriptions-item>
            </a-descriptions>
        </a-spin>
    </a-drawer>
    <MediaPreview
        :images="previewImages"
        :index="previewIndex"
        :visible="previewVisible"
        @close="previewVisible = false"
    />
</template>
<style lang="scss">
.image-list {
    height: 100%;
    overflow: auto;
}
.spin {
    animation: spin 1s linear infinite;
}
.modern-spinner {
    display: inline-block;
    vertical-align: middle;
    animation: none;
}
@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
.card-item {
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    box-shadow: 0 2px 8px var(--color-card-shadow, rgba(0, 0, 0, 0.07));
    transition:
        background 0.2s,
        border 0.2s,
        box-shadow 0.2s;
}
.card-item:hover {
    background: var(--color-card-hover, var(--color-card-selected, #f0f8ff));
    border-color: var(--color-card-hover-border, var(--color-primary));
    box-shadow: 0 4px 16px var(--color-card-hover-shadow, rgba(0, 0, 0, 0.12));
}
.card-item.active {
    background: var(--color-card-active, var(--color-card-selected, #e3f2fd));
    border-color: var(--color-card-active-border, var(--color-primary));
    box-shadow: 0 0 0 2px var(--color-primary);
}
.card-item.disabled {
    background: var(--color-card-disabled, #f5f5f5);
    color: var(--color-card-disabled-text, #bbb);
    border-color: var(--color-card-disabled-border, #eee);
    opacity: 0.6;
    cursor: not-allowed;
}
</style>
