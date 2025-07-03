<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted, nextTick } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { storeToRefs } from "pinia";
import { createThumbnailTask, getImageType, getPhotasaConfig } from "@renderer/utils/api";
import { trim } from "radash";
import type { ImageTypeResult } from "image-type";
import { JsonTreeView } from "json-tree-view-vue3";
import type { Tags, XmpTags, IccTags } from "exifreader";
import { useI18n } from "vue-i18n";
import { openInFinder } from "@renderer/utils/api";
import { Photo } from "@renderer/utils/folder-tree";
import LazyImage from "./LazyImage.vue";
import ImageFallback from "@renderer/assets/images/fallback.png";
import { useVirtualizer } from "@tanstack/vue-virtual";
import PhotoPreview from "./PhotoPreview.vue";

const { t } = useI18n();

type Card = {
    title: string;
    parts: string[];
    images: Image[];
};

type Image = {
    key: string;
    src: string;
    thumbnail: string;
    preview: string;
    raw: string; // For Heic file, it's the original file
    isVideo: boolean;
};

type ImageMeta = {
    imageType: ImageTypeResult;
    tags: Tags | XmpTags | IccTags;
    path: string;
    maxDepth: number;
    json: string;
};

const preferenceStore = usePreferenceStore();
const { thumbnailSize, currentFolder, currentFolderConfig } = storeToRefs(preferenceStore);

const showInfo = ref(false);
const loadingInfo = ref(false);
const loadingPhotasaConfig = ref(false);
const fallback = ref(ImageFallback);
const imageListRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
const mouseEnterDelay = ref(1.5);
const previewVisible = ref(false);
const previewIndex = ref(0);

function toImage(file: Photo): Image {
    const preview =
        file.path.indexOf(".heic") >= 0
            ? file.thumbnail.replace(".heic.png", ".jpeg").replace("thumbnail-", "")
            : file.path;
    return {
        key: file.path,
        src: `file://${currentFolder.value}/${file.thumbnail}`,
        thumbnail: `file://${currentFolder.value}/${file.thumbnail}`,
        preview: `file://${currentFolder.value}/${preview}`,
        raw: `file://${currentFolder.value}/${file.path}`,
        isVideo: file.isVideo,
    };
}

watch(currentFolder, async (newVal) => {
    if (newVal) {
        loadingPhotasaConfig.value = true;
        currentFolderConfig.value = await getPhotasaConfig(currentFolder.value);
        loadingPhotasaConfig.value = false;
    }
});

const card = computed<Card>(() => {
    const images =
        currentFolderConfig.value.photoList?.map((config) => {
            return toImage(config);
        }) ?? [];

    return {
        title: currentFolder.value,
        images,
        parts: currentFolder.value?.split("/"),
    };
});

const imageMeta = reactive<ImageMeta>({
    imageType: {} as ImageTypeResult,
    tags: {},
    path: "",
    maxDepth: 3,
    json: "",
});

async function rebuildThumbnail(image: Image): Promise<void> {
    await createThumbnailTask.perform({
        path: image.raw ?? image.preview,
        thumbnail: image.src as string,
        width: thumbnailSize.value,
        height: thumbnailSize.value,
        always: true,
        preview: "",
    });

    // force to render the component
    image.thumbnail = `${image.src}?${Date.now()}`;
}

function openImageMeta(image: Image): void {
    showInfo.value = true;
    loadingInfo.value = true;
    const path = `/${trim(image.raw, "file://")}`;
    getImageType(path).then((info) => {
        loadingInfo.value = false;
        imageMeta.imageType = info.imageType ?? {};
        imageMeta.json = JSON.stringify(info.tags ?? {});
        imageMeta.tags = info.tags ?? {};
        imageMeta.path = path;
    });
}

function openFileInFilder(image: Image): void {
    const path = `/${trim(image.raw, "file://")}`;
    openInFinder(path);
}

function updateContainerWidth() {
    if (imageListRef.value) {
        containerWidth.value = imageListRef.value.clientWidth;
    }
}

watch(imageListRef, () => updateContainerWidth());
watch(thumbnailSize, () => updateContainerWidth());

const columns = computed((): number => {
    if (!containerWidth.value) return 1;
    const gap = 16;
    const padding = 24; // px-4 左右各 16
    const cardWidth = thumbnailSize.value + 2 * padding;
    const available = containerWidth.value - gap;
    const cols = Math.floor(available / (cardWidth + gap));

    return Math.max(1, cols);
});

const rows = computed((): Image[][] => {
    const imgs: Image[] = card.value?.images || [];
    const cols = columns.value;
    const result: Image[][] = [];
    for (let i = 0; i < imgs.length; i += cols) {
        result.push(imgs.slice(i, i + cols));
    }
    return result;
});

const rowHeight = computed(() => thumbnailSize.value + 16);
const virtualizer = useVirtualizer<HTMLElement, Element>({
    count: rows.value.length,
    getScrollElement: () => imageListRef.value,
    estimateSize: () => rowHeight.value,
    overscan: 4,
});
const virtualRows = computed(() => virtualizer.value?.getVirtualItems() ?? []);
const virtualizerHeight = computed(() => (virtualizer.value?.getTotalSize() ?? 0) + "px");

const previewImages = computed(() =>
    card.value.images.map((img) => ({
        src: img.preview,
        w: 1200, // 可根据实际图片宽度调整
        h: 900, // 可根据实际图片高度调整
        title: img.key,
    })),
);

function openPreview(rowIdx, colIdx) {
    const idx = rowIdx * columns.value + colIdx;
    previewIndex.value = idx;
    previewVisible.value = true;
}

let resizeObserver: ResizeObserver | null = null;

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

watch(rows, () => {
    if (virtualizer.value) {
        virtualizer.value.options.count = rows.value.length;
        virtualizer.value.measure();
    }
});

watch(containerWidth, () => {
    if (virtualizer.value) {
        virtualizer.value.measure();
    }
});

onUnmounted(() => {
    window.removeEventListener("resize", updateContainerWidth);
    if (resizeObserver && imageListRef.value) {
        resizeObserver.unobserve(imageListRef.value);
    }
});
</script>

<template>
    <div class="flex flex-col h-full min-h-0 bg-white rounded-lg shadow border border-gray-200">
        <!-- 标题区 -->
        <div class="px-4 py-2 border-b border-gray-100 flex items-center">
            <a-breadcrumb>
                <a-breadcrumb-item v-for="part in card.parts" :key="part">{{
                    part
                }}</a-breadcrumb-item>
            </a-breadcrumb>
        </div>
        <!-- 内容区 -->
        <div ref="imageListRef" class="flex-1 min-h-0 overflow-auto image-list relative">
            <!-- loading骨架屏+美观遮罩+Heroicons动画 -->
            <div
                v-if="loadingPhotasaConfig"
                class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-br from-white/90 to-blue-100/80 transition-opacity duration-300 rounded-lg shadow-lg pointer-events-auto"
                style="backdrop-filter: blur(2px)"
            >
                <div class="flex flex-wrap gap-6 justify-center mb-6">
                    <div
                        v-for="i in 8"
                        :key="i"
                        class="w-[150px] h-[150px] bg-gray-200 rounded-lg animate-pulse"
                    ></div>
                </div>
                <div class="flex items-center mt-2">
                    <!-- Heroicons ArrowPathIcon 官方标准 -->
                    <svg
                        class="!animate-spin h-10 w-10 text-blue-500 spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 4v4m0 0l-2-2m2 2l2-2m6 6a9 9 0 11-6-8.485"
                        />
                    </svg>
                    <span class="ml-4 text-blue-500 font-semibold text-lg">加载中...</span>
                </div>
            </div>
            <!-- 虚拟滚动渲染图片行 -->
            <div v-else style="position: relative; width: 100%; height: 100%">
                <div
                    :style="{
                        height: virtualizerHeight,
                        position: 'relative',
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
                                                    @click="openFileInFilder(image)"
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
                <a-descriptions-item label="MIME Type">{{
                    imageMeta.imageType.mime
                }}</a-descriptions-item>
                <a-descriptions-item label="MIME Type">{{
                    imageMeta.imageType.ext
                }}</a-descriptions-item>
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
    <PhotoPreview
        :images="previewImages"
        :index="previewIndex"
        :visible="previewVisible"
        @close="previewVisible = false"
        @change="(i) => (previewIndex = i)"
    />
</template>
<style lang="less">
.image-list {
    height: 100%;
    overflow: auto;
}
.spin {
    animation: spin 1s linear infinite;
}
@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
</style>
