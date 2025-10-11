<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { storeToRefs } from "pinia";
import { getFileMetadata } from "@renderer/utils/api";
import type { FileMetadata } from "@common/import-types";
import { type Card, type Image, toImageMeta, groupImagesByColumns } from "@renderer/common/image";
// removeFileProtocol 通过 preload API 使用
import * as R from "ramda";
import { useI18n } from "vue-i18n";
import { openInFinder } from "@renderer/utils/api-path";
import {
    BaseImage,
    BaseContextMenu,
    BaseMenuItem,
    BaseBreadcrumb,
    BaseBreadcrumbItem,
    BaseTooltip,
    BaseCard,
    FileCountBadge,
} from "@renderer/components/ui";
import { loggers } from "@common/logger";
// 在测试环境中使用data URL，避免网络请求
import fallbackImage from "@renderer/assets/images/fallback.png";
const ImageFallback =
    process.env.NODE_ENV === "test"
        ? "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A"
        : fallbackImage;
import { useVirtualizer } from "@tanstack/vue-virtual";
import MediaPreview from "./MediaPreview.vue";
import EmptyState from "./common/EmptyState.vue";
import LoadingState from "./common/LoadingState.vue";
import FileInfoDrawer from "./FileInfoDrawer.vue";
import { computeColumns, requestThumbnail, toImageList } from "./ImageListHelper";
import { safePositiveNumber } from "@renderer/common/number";

// 定义组件事件
const emit = defineEmits<{
    import: [];
}>();

// 国际化
const { t } = useI18n();
const logger = loggers.renderer;
// 偏好设置
const preferenceStore = usePreferenceStore();
// 偏好设置的引用
const { thumbnailSize, currentFolder, currentFolderConfig } = storeToRefs(preferenceStore);
// 显示图片元数据
const showInfo = ref(false);
// 加载图片元数据
const loadingInfo = ref(false);
// 加载文件夹配置
const loadingPhotasaConfig = ref(true); // 初始为true，等待配置加载
// 图片加载失败
const fallback = ref(ImageFallback);
// 图片列表的引用
const imageListRef = ref<HTMLElement | null>(null);
// 容器宽度
const containerWidth = ref(800); // 设置默认宽度
// 鼠标悬停延迟
const mouseEnterDelay = ref(1.5);
// 预览是否可见
const previewVisible = ref(false);
// 预览索引
const previewIndex = ref(0);

// 卡片
const card = computed<Card>(() => {
    const result = toImageList(currentFolder.value, currentFolderConfig.value);

    return result;
});

// 文件统计
const imageCount = computed(() => {
    if (!card.value?.images) return 0;
    return card.value.images.filter((item) => !item.isVideo).length;
});

const videoCount = computed(() => {
    if (!card.value?.images) return 0;
    return card.value.images.filter((item) => item.isVideo).length;
});

// 文件元数据（支持图片/视频/文件信息）
const fileMeta = ref<FileMetadata | null>(null);

// 重建缩略图
async function rebuildThumbnail(image: Image) {
    await requestThumbnail(image, safeThumbnailSize.value);
}

// 打开文件元数据（支持图片/视频/文件）
async function openImageMeta(image: Image): Promise<void> {
    showInfo.value = true;
    loadingInfo.value = true;

    try {
        // 直接使用 file:// URL，path 处理在 preload 层完成
        const metadata = await getFileMetadata(image.raw);
        fileMeta.value = metadata;
    } catch (error) {
        logger.error("Failed to load file metadata:", error);
        fileMeta.value = null;
    } finally {
        loadingInfo.value = false;
    }
}

// 打开文件夹 - 直接传递 file:// URL，让 preload 层处理转换
function openFileInFolder(image: Image): void {
    openInFinder(image.raw);
}

// 更新容器宽度
function updateContainerWidth() {
    if (imageListRef.value) {
        containerWidth.value = imageListRef.value.clientWidth;
    }
}

// 防抖更新函数
let updateTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedUpdate = () => {
    if (updateTimeout) {
        clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(() => {
        updateContainerWidth();
        nextTick(() => {
            initializeVirtualizer();
        });
    }, 16); // 约60fps
};

// 安全的缩略图尺寸（确保为数字类型）
const safeThumbnailSize = computed(() => safePositiveNumber(thumbnailSize.value, 150));

// 列数 - 添加缓存避免不必要的重计算
const columns = computed((): number => {
    // 如果容器宽度为0，返回默认值
    if (!containerWidth.value) {
        return 1;
    }
    const cols = computeColumns(containerWidth.value, safeThumbnailSize.value);
    return cols;
});

// 行数
const rows = computed((): Image[][] => {
    const images = card.value?.images || [];
    const groupedRows = groupImagesByColumns(images, columns.value);

    return groupedRows;
});

// 行高
const rowHeight = computed(() => safeThumbnailSize.value + 16);
// 虚拟滚动 - 使用稳定的初始值避免重新创建
const virtualizer = useVirtualizer<HTMLElement, Element>({
    count: 0, // 初始为0，通过watch更新
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
function openPreview(rowIdx: number, colIdx: number) {
    const idx = rowIdx * columns.value + colIdx;
    previewIndex.value = idx;
    previewVisible.value = true;
}

// 强制刷新图片列表
function refreshImageList() {
    clearDataState();
    nextTick(() => {
        updateContainerWidth();
        initializeVirtualizer();
    });
}

// 暴露刷新方法给父组件
defineExpose({
    refreshImageList,
});

// 监听容器宽度变化
watch(imageListRef, () => updateContainerWidth(), { flush: "post" });
// 监听缩略图大小变化
watch(safeThumbnailSize, () => updateContainerWidth(), { flush: "post" });
// 监听当前文件夹变化，确保数据清理
watch(currentFolder, (newFolder, oldFolder) => {
    if (oldFolder && newFolder !== oldFolder) {
        // 清理当前数据
        clearDataState();
        // 显示加载状态
        loadingPhotasaConfig.value = true;
    }
});

// 监听配置变化，管理加载状态
watch(
    currentFolderConfig,
    () => {
        // 配置已加载，隐藏加载状态
        loadingPhotasaConfig.value = false;
    },
    { immediate: true },
);

// 清理数据状态
const clearDataState = () => {
    previewVisible.value = false;
    previewIndex.value = 0;
    fileMeta.value = null;
    showInfo.value = false;
    loadingInfo.value = false;
};

// 初始化虚拟滚动器
const initializeVirtualizer = () => {
    if (virtualizer.value) {
        // 强制重置虚拟滚动器状态
        virtualizer.value.options.count = rows.value.length;
        // 重置滚动位置到顶部
        if (virtualizer.value.scrollElement) {
            virtualizer.value.scrollElement.scrollTop = 0;
        }
        virtualizer.value.measure();
    }
};

// 监听卡片数据变化，统一处理数据更新和虚拟滚动器重置
watch(
    card,
    (newCard, oldCard) => {
        // 如果数据完全改变（比如切换文件夹），重置所有状态
        if (oldCard && newCard.title !== oldCard.title) {
            clearDataState();
        }

        nextTick(() => {
            updateContainerWidth();
            initializeVirtualizer();
        });
    },
    { flush: "post" },
);

// 监听行数变化 - 合并到统一的更新函数中
watch(
    rows,
    () => {
        nextTick(() => {
            initializeVirtualizer();
        });
    },
    { flush: "post" },
);

// 监听容器宽度变化 - 合并到统一的更新函数中
watch(
    containerWidth,
    () => {
        nextTick(() => {
            initializeVirtualizer();
        });
    },
    { flush: "post" },
);

// 挂载
onMounted(() => {
    // 确保初始状态是干净的
    clearDataState();

    // 检查是否已经有有效数据，如果有则立即隐藏加载状态
    if (
        currentFolder.value &&
        currentFolderConfig.value &&
        Object.keys(currentFolderConfig.value).length > 0
    ) {
        loadingPhotasaConfig.value = false;
    }

    updateContainerWidth();
    // 初始化虚拟滚动器
    nextTick(() => {
        initializeVirtualizer();
    });

    window.addEventListener("resize", debouncedUpdate);

    // 使用 ResizeObserver 监听容器宽度变化
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
        class="flex flex-col h-full min-h-0"
        style="background: var(--color-card-bg); border-color: var(--color-card-border)"
    >
        <!-- 标题区 -->
        <div
            class="px-4 py-2 border-b flex items-center justify-between"
            style="border-color: var(--color-border); background: var(--color-bg-secondary)"
        >
            <BaseBreadcrumb>
                <BaseBreadcrumbItem
                    v-for="(part, index) in card.parts"
                    :key="part"
                    :isLast="index === card.parts.length - 1"
                >
                    {{ part }}
                </BaseBreadcrumbItem>
            </BaseBreadcrumb>

            <!-- 文件统计 -->
            <FileCountBadge
                :image-count="imageCount"
                :video-count="videoCount"
                :is-loading="loadingPhotasaConfig"
                :show-breakdown="true"
            />
        </div>
        <!-- 内容区 -->
        <div
            ref="imageListRef"
            class="flex-1 min-h-0 overflow-auto image-list relative scrollbar-theme"
            style="background: var(--color-card-bg)"
        >
            <!-- 加载状态遮罩 -->
            <div
                v-if="loadingPhotasaConfig"
                class="absolute inset-0 bg-opacity-50 flex items-center justify-center z-10"
                style="background: var(--color-card-bg); opacity: 0.9"
            >
                <LoadingState :loadingText="t('import.loading.switchingFolder')" :size="50" />
            </div>
            <!-- 空状态：集成通用 EmptyState 组件 -->
            <template v-else-if="rows.length === 0">
                <EmptyState
                    :emptyText="t('empty.image')"
                    :buttonText="t('empty.importBtn')"
                    @buttonClick="emit('import')"
                />
            </template>
            <!-- 虚拟滚动渲染图片行 -->
            <div v-else style="position: relative; width: 100%; height: 100%">
                <div
                    :key="`virtualizer-${card.title}-${card.images.length}`"
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
                        <div
                            class="w-full flex justify-start pl-4"
                            style="gap: 16px; max-width: 100%"
                        >
                            <template v-for="(image, colIndex) in rows[row.index]" :key="image.key">
                                <BaseContextMenu>
                                    <div @click="openPreview(row.index, colIndex)">
                                        <BaseTooltip
                                            placement="right"
                                            :mouse-enter-delay="mouseEnterDelay"
                                            :title="image.raw"
                                        >
                                            <BaseCard
                                                hoverable
                                                :bodyPadding="false"
                                                :style="{
                                                    height: safeThumbnailSize + 'px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: 'var(--color-image-item-bg)', // 独立图片项背景色，支持主题
                                                    padding: 0,
                                                    minWidth: safeThumbnailSize + 'px',
                                                }"
                                            >
                                                <BaseImage
                                                    :width="safeThumbnailSize"
                                                    :height="safeThumbnailSize"
                                                    :src="image.thumbnail"
                                                    :fallback="fallback"
                                                    :raw="image.raw"
                                                    :is-video="image.isVideo"
                                                />
                                            </BaseCard>
                                        </BaseTooltip>
                                    </div>

                                    <template #menu="{ close }">
                                        <BaseMenuItem
                                            @click="
                                                openImageMeta(image);
                                                close();
                                            "
                                        >
                                            {{ t("menu.getInfo") }}
                                        </BaseMenuItem>
                                        <BaseMenuItem
                                            @click="
                                                rebuildThumbnail(image);
                                                close();
                                            "
                                        >
                                            {{ t("menu.rebuildThumbnail") }}
                                        </BaseMenuItem>
                                        <BaseMenuItem
                                            @click="
                                                openFileInFolder(image);
                                                close();
                                            "
                                        >
                                            {{ t("menu.open") }}
                                        </BaseMenuItem>
                                    </template>
                                </BaseContextMenu>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
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
