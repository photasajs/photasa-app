<script setup lang="ts">
import { useIntersectionObserver } from "@vueuse/core";
import { onMounted, ref, toRefs, watch } from "vue";
import { useI18n } from "vue-i18n";
import { prefetchImageTask } from "@renderer/utils/image-prefetch";
import { BaseSpinner, FileTypeBadge } from "@renderer/components/ui";

// Define props and emits
const props = defineProps<{
    src: string;
    height: number;
    width: number;
    fallback: string;
    isVideo: boolean;
    raw: string;
    /** 后端占位缩略图（如 RAW 无解码器）；与 img @error 的 fallback URL 不同 */
    isPlaceholderThumbnail?: boolean;
}>();

const { src, height, width, fallback, isVideo, isPlaceholderThumbnail } = toRefs(props);
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
    try {
        await prefetchImageTask.perform(imageSrc);
    } catch {
        /* empty */
    } finally {
        isLoading.value = false;
        isReady.value = true;
        actualSrc.value = imageSrc;
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
const targetIsVisible = ref(false);

useIntersectionObserver(target, ([{ isIntersecting }]) => {
    targetIsVisible.value = isIntersecting;
});
</script>

<template>
    <div
        ref="target"
        class="thumbnail-image"
        :style="{
            width: width + 'px',
            height: height + 'px',
        }"
    >
        <div class="relative flex items-center justify-center w-full h-full">
            <BaseSpinner v-if="targetIsVisible && isLoading" size="md" />
            <img
                v-else-if="targetIsVisible && isReady"
                :src="actualSrc"
                :alt="'Image'"
                :style="{
                    margin: 'auto',
                    objectFit: 'contain',
                    width: width + 'px',
                    height: height + 'px',
                    display: 'block',
                    background: 'transparent',
                }"
                @error="
                    (event: Event) => {
                        const target = event.target as HTMLImageElement;
                        if (target) target.src = fallback;
                    }
                "
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
