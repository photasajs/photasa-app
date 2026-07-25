<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { storeToRefs } from "pinia";
import type { FileMetadata } from "@photasa/common";
import { type Card, type Image, toImageMeta, groupImagesByColumns } from "@renderer/common/image";
import * as R from "ramda";
import { useI18n } from "vue-i18n";
import { useZhangSunWuJi } from "@renderer/composables/useZhangSunWuJi";
import {
    BaseBreadcrumb,
    BaseBreadcrumbItem,
    FileCountBadge,
    VirtualizedGrid,
} from "@renderer/components/ui";
import ImageListItem from "./ImageListItem.vue";
import { loggers } from "@photasa/common";
import { ensureWebviewMediaUrl } from "@renderer/utils/media-url";
import fallbackImage from "@renderer/assets/images/fallback.png";
const ImageFallback =
    process.env.NODE_ENV === "test"
        ? "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A"
        : ensureWebviewMediaUrl(fallbackImage);
import MediaPreview from "./MediaPreview.vue";
import EmptyState from "./common/EmptyState.vue";
import LoadingState from "./common/LoadingState.vue";
import FileInfoDrawer from "./FileInfoDrawer.vue";
import {
    computeColumns,
    hydrateFolderThumbnailMtimes,
    requestThumbnail,
    toImageList,
} from "./ImageListHelper";
import { getThumbnailRenderKey, thumbnailDisplayEpoch } from "@renderer/utils/thumbnail-display";
import { safePositiveNumber } from "@renderer/common/number";
import { useGalleryMedia } from "@renderer/composables/useGalleryMedia";

const GRID_GAP_PX = 16;
const GRID_TOP_MARGIN_PX = 16;
const GRID_OVERSCAN = 4;

const emit = defineEmits<{
    import: [];
}>();

const { t } = useI18n();
const logger = loggers.renderer;
const zhangSunWuJi = useZhangSunWuJi();
const galleryMedia = useGalleryMedia();
const preferenceStore = usePreferenceStore();
const { thumbnailSize, currentFolder, currentFolderConfig } = storeToRefs(preferenceStore);

const showInfo = ref(false);
const loadingInfo = ref(false);
const loadingPhotasaConfig = ref(true);
const fallback = ref(ImageFallback);
const imageListRef = ref<HTMLElement | null>(null);
const gridRef = ref<{
    measure: () => void;
    scrollToOffset: (offset: number) => void;
    scrollToRow: (index: number, options?: { align?: "start" | "center" | "end" | "auto" }) => void;
} | null>(null);
const containerWidth = ref(800);
const mouseEnterDelay = ref(1.5);
const previewVisible = ref(false);
const previewIndex = ref(0);

const card = computed<Card>(() => toImageList(currentFolder.value, currentFolderConfig.value));

const imageCount = computed(() => {
    if (!card.value?.images) return 0;
    return card.value.images.filter((item) => !item.isVideo).length;
});

const videoCount = computed(() => {
    if (!card.value?.images) return 0;
    return card.value.images.filter((item) => item.isVideo).length;
});

const fileMeta = ref<FileMetadata | null>(null);

async function rebuildThumbnail(image: Image): Promise<void> {
    try {
        await requestThumbnail(image, safeThumbnailSize.value, galleryMedia.createThumbnail);
    } catch (error) {
        logger.error("🏛️ 重建缩略图失败", error);
    }
}

async function openImageMeta(image: Image): Promise<void> {
    showInfo.value = true;
    loadingInfo.value = true;

    try {
        const metadata = await galleryMedia.fileMetadata(image.raw);
        fileMeta.value = metadata;
    } catch (error) {
        logger.error("Failed to load file metadata:", error);
        fileMeta.value = null;
    } finally {
        loadingInfo.value = false;
    }
}

function openFileInFolder(image: Image): void {
    zhangSunWuJi.openInFinder(image.raw);
}

function updateContainerWidth(): void {
    if (imageListRef.value) {
        containerWidth.value = imageListRef.value.clientWidth;
    }
}

function resolveScrollElement(): HTMLElement | null {
    return imageListRef.value;
}

let updateTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedUpdate = () => {
    if (updateTimeout) {
        clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(() => {
        updateContainerWidth();
        nextTick(() => {
            gridRef.value?.measure();
        });
    }, 16);
};

const safeThumbnailSize = computed(() => safePositiveNumber(thumbnailSize.value, 150));

const columns = computed((): number => {
    if (!containerWidth.value) {
        return 1;
    }
    return computeColumns(containerWidth.value, safeThumbnailSize.value);
});

const rows = computed((): Image[][] => {
    const images = card.value?.images || [];
    return groupImagesByColumns(images, columns.value);
});

const previewImages = computed(() => R.map(toImageMeta, card.value.images));

let resizeObserver: ResizeObserver | null = null;

function openPreview(rowIdx: number, colIdx: number): void {
    const idx = rowIdx * columns.value + colIdx;
    previewIndex.value = idx;
    previewVisible.value = true;
}

function scrollToImageIndex(index: number): void {
    if (columns.value <= 0) {
        return;
    }
    const rowIndex = Math.floor(index / columns.value);
    gridRef.value?.scrollToRow(rowIndex, { align: "center" });
}

function clearDataState(): void {
    previewVisible.value = false;
    previewIndex.value = 0;
    fileMeta.value = null;
    showInfo.value = false;
    loadingInfo.value = false;
}

function resetGridScroll(): void {
    nextTick(() => {
        if (imageListRef.value) {
            imageListRef.value.scrollTop = 0;
        }
        gridRef.value?.scrollToOffset(0);
    });
}

function refreshImageList(): void {
    clearDataState();
    nextTick(() => {
        updateContainerWidth();
        gridRef.value?.measure();
        gridRef.value?.scrollToOffset(0);
    });
}

defineExpose({
    refreshImageList,
    scrollToImageIndex,
});

watch(imageListRef, () => updateContainerWidth(), { flush: "post" });
watch(safeThumbnailSize, () => updateContainerWidth(), { flush: "post" });

watch(currentFolder, (newFolder, oldFolder) => {
    if (oldFolder && newFolder !== oldFolder) {
        clearDataState();
        loadingPhotasaConfig.value = true;
        resetGridScroll();
    }
});

watch(
    currentFolderConfig,
    () => {
        loadingPhotasaConfig.value = false;
    },
    { immediate: true },
);

watch(
    () => [currentFolder.value, currentFolderConfig.value.photoList] as const,
    ([folder, photoList]) => {
        if (!folder || !photoList?.length) {
            return;
        }
        void hydrateFolderThumbnailMtimes(folder, photoList, galleryMedia.filesModified);
    },
    { immediate: true },
);

watch(
    () => card.value.title,
    (newTitle, oldTitle) => {
        if (oldTitle && newTitle !== oldTitle) {
            clearDataState();
            resetGridScroll();
        }
    },
);

onMounted(() => {
    clearDataState();

    if (
        currentFolder.value &&
        currentFolderConfig.value &&
        Object.keys(currentFolderConfig.value).length > 0
    ) {
        loadingPhotasaConfig.value = false;
    }

    updateContainerWidth();
    window.addEventListener("resize", debouncedUpdate);

    if (imageListRef.value) {
        resizeObserver = new ResizeObserver(debouncedUpdate);
        resizeObserver.observe(imageListRef.value);
    }
});

onUnmounted(() => {
    window.removeEventListener("resize", debouncedUpdate);
    if (updateTimeout) {
        clearTimeout(updateTimeout);
    }
    if (resizeObserver && imageListRef.value) {
        resizeObserver.unobserve(imageListRef.value);
    }
});
</script>

<template>
    <div
        class="flex flex-col h-full min-h-0"
        style="background: var(--color-card-bg); border-color: var(--color-card-border)"
    >
        <div
            class="px-4 h-12 border-b flex items-center justify-between gap-3 min-w-0"
            style="border-color: var(--color-border); background: var(--color-bg-secondary)"
        >
            <BaseBreadcrumb class="min-w-0 flex-1 overflow-hidden">
                <BaseBreadcrumbItem
                    v-for="(part, index) in card.parts"
                    :key="`${index}-${part}`"
                    :text="part"
                    :isLast="index === card.parts.length - 1"
                />
            </BaseBreadcrumb>

            <FileCountBadge
                :image-count="imageCount"
                :video-count="videoCount"
                :is-loading="loadingPhotasaConfig"
                :show-breakdown="true"
            />
        </div>

        <div
            ref="imageListRef"
            class="flex-1 min-h-0 overflow-auto image-list relative scrollbar-theme"
            style="background: var(--color-card-bg)"
        >
            <div
                v-if="loadingPhotasaConfig"
                class="absolute inset-0 bg-opacity-50 flex items-center justify-center z-10"
                style="background: var(--color-card-bg); opacity: 0.9"
            >
                <LoadingState :loadingText="t('import.loading.switchingFolder')" :size="50" />
            </div>

            <EmptyState
                v-if="!loadingPhotasaConfig && rows.length === 0"
                :emptyText="t('empty.image')"
                :buttonText="t('empty.importBtn')"
                @buttonClick="emit('import')"
            />

            <VirtualizedGrid
                v-if="rows.length > 0"
                ref="gridRef"
                :rows="rows"
                :row-height="safeThumbnailSize"
                :gap="GRID_GAP_PX"
                :top-margin="GRID_TOP_MARGIN_PX"
                :overscan="GRID_OVERSCAN"
                :resolve-scroll-element="resolveScrollElement"
            >
                <template #item="{ item, rowIndex, colIndex }">
                    <ImageListItem
                        :key="`${thumbnailDisplayEpoch}-${getThumbnailRenderKey(item)}`"
                        :image="item"
                        :thumbnail-size="safeThumbnailSize"
                        :fallback="fallback"
                        :mouse-enter-delay="mouseEnterDelay"
                        :rebuild-thumbnail="rebuildThumbnail"
                        @preview="openPreview(rowIndex, colIndex)"
                        @open-meta="openImageMeta(item)"
                        @open-in-folder="openFileInFolder(item)"
                    />
                </template>
            </VirtualizedGrid>
        </div>
    </div>

    <FileInfoDrawer v-model="showInfo" :file-meta="fileMeta" :loading="loadingInfo" />
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
