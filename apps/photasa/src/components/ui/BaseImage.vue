<script setup lang="ts">
import { useIntersectionObserver } from "@vueuse/core";
import { computed, onMounted, ref, toRefs, watch } from "vue";
import { useI18n } from "vue-i18n";
import { prefetchImageTask } from "@renderer/utils/image-prefetch";
import { ensureWebviewMediaUrl } from "@renderer/utils/media-url";
import { resolveNextImageSrcOnError } from "@renderer/utils/base-image-error-fallback";
import { BaseSpinner, FileTypeBadge } from "@renderer/components/ui";

// Define props and emits
const props = withDefaults(
    defineProps<{
        src: string;
        height: number;
        width: number;
        fallback: string;
        isVideo: boolean;
        raw: string;
        /** HEIC 等预览图路径；@error 时在 raw 之前尝试 */
        preview?: string;
        /** false：lightbox 不回退到缩略图 URL */
        fallbackToThumbnail?: boolean;
        /** true：跳过 IntersectionObserver，立即加载（lightbox 用） */
        eagerLoad?: boolean;
        /** true：按视口自适应（lightbox），不用固定 width/height */
        fitViewport?: boolean;
        /** 后端占位缩略图（如 RAW 无解码器）；与 img @error 的 fallback URL 不同 */
        isPlaceholderThumbnail?: boolean;
    }>(),
    {
        fallbackToThumbnail: true,
        eagerLoad: false,
        fitViewport: false,
    },
);

const {
    src,
    height,
    width,
    fallback,
    isVideo,
    isPlaceholderThumbnail,
    raw,
    preview,
    fallbackToThumbnail,
    eagerLoad,
    fitViewport,
} = toRefs(props);
const { t } = useI18n();
const isReady = ref(false);
const actualSrc = ref("");
const isLoading = ref(false);

watch(src, () => {
    if (!isVideo.value) {
        isReady.value = false;
        isLoading.value = true;
        prefetchImage(src.value);
    } else {
        isReady.value = true;
    }
});

async function prefetchImage(imageSrc: string): Promise<void> {
    const loadableSrc = ensureWebviewMediaUrl(imageSrc);
    try {
        await prefetchImageTask.perform(loadableSrc);
    } catch {
        /* empty */
    } finally {
        isLoading.value = false;
        isReady.value = true;
        actualSrc.value = loadableSrc;
    }
}

onMounted(() => {
    // 预加载图片，避免图片加载时，出现闪烁
    if (!isVideo.value) {
        isLoading.value = true;
        prefetchImage(src.value);
    } else {
        isReady.value = true;
        actualSrc.value = src.value;
    }
});

const target = ref(null);
const targetIsVisible = ref(eagerLoad.value);

useIntersectionObserver(target, ([{ isIntersecting }]) => {
    targetIsVisible.value = eagerLoad.value || isIntersecting;
});

function handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) {
        return;
    }

    const nextSrc = resolveNextImageSrcOnError({
        currentSrc: img.src,
        preview: preview.value,
        raw: raw.value,
        fallback: fallback.value,
        fallbackToThumbnail: fallbackToThumbnail.value,
    });

    if (nextSrc) {
        img.src = nextSrc;
    }
}

const LIGHTBOX_MAX_WIDTH = "80vw";
const LIGHTBOX_MAX_HEIGHT = "80vh";

const containerStyle = computed(() => {
    if (fitViewport.value) {
        return {
            maxWidth: LIGHTBOX_MAX_WIDTH,
            maxHeight: LIGHTBOX_MAX_HEIGHT,
            width: "auto",
            height: "auto",
        };
    }

    return {
        width: `${width.value}px`,
        height: `${height.value}px`,
    };
});

const imageStyle = computed(() => {
    if (fitViewport.value) {
        return {
            margin: "auto",
            objectFit: "contain",
            maxWidth: LIGHTBOX_MAX_WIDTH,
            maxHeight: LIGHTBOX_MAX_HEIGHT,
            width: "auto",
            height: "auto",
            display: "block",
            background: "transparent",
        };
    }

    return {
        margin: "auto",
        objectFit: "contain",
        width: `${width.value}px`,
        height: `${height.value}px`,
        display: "block",
        background: "transparent",
    };
});
</script>

<template>
    <div
        ref="target"
        class="thumbnail-image"
        :class="{ 'thumbnail-image--fit-viewport': fitViewport }"
        :style="containerStyle"
    >
        <div class="relative flex items-center justify-center w-full h-full">
            <BaseSpinner v-if="targetIsVisible && isLoading" size="md" />
            <img
                v-else-if="targetIsVisible && isReady"
                :src="actualSrc"
                :alt="'Image'"
                :style="imageStyle"
                @error="handleImageError"
            />

            <!-- 文件类型标识 -->
            <FileTypeBadge
                :file-path="raw"
                :is-video="isVideo"
                :show-format="width > 100"
                :size="width > 150 ? 'large' : width > 100 ? 'medium' : 'small'"
            />
            <!-- RAW 等占位缩略图提示（RFC 0102 / 0097） -->
            <div
                v-if="isPlaceholderThumbnail && targetIsVisible"
                class="thumbnail-placeholder-badge"
                :title="t('imageList.placeholderThumbnail')"
            >
                {{ t("imageList.placeholderThumbnail") }}
            </div>
        </div>
    </div>
</template>
<style lang="less">
.thumbnail-image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: var(--color-thumbnail-image-bg);
}

.thumbnail-image--fit-viewport {
    width: auto;
    height: auto;
    background: transparent;
}

.thumbnail-placeholder-badge {
    position: absolute;
    bottom: 4px;
    left: 4px;
    z-index: 11;
    max-width: calc(100% - 8px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 600;
    color: #fff;
    background: rgba(15, 23, 42, 0.72);
    pointer-events: none;
    backdrop-filter: blur(4px);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

.video-player {
    position: relative;
    width: 100%;
    height: 60vh;
}
</style>
