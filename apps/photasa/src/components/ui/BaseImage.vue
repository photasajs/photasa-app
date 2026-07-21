<script setup lang="ts">
import { useIntersectionObserver } from "@vueuse/core";
import { onMounted, ref, toRefs, watch } from "vue";
import { prefetchImageTask } from "@renderer/utils/image-prefetch";
import { ensureWebviewMediaUrl } from "@renderer/utils/media-url";
import { BaseSpinner, FileTypeBadge } from "@renderer/components/ui";

// 与 Electron BaseImage 相同：6 个 prop；Tauri 仅在 prefetch / @error 时规范化 URL
const props = defineProps<{
    src: string;
    height: number;
    width: number;
    fallback: string;
    isVideo: boolean;
    raw: string;
}>();

const { src, height, width, fallback, isVideo, raw } = toRefs(props);
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

function handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img) {
        img.src = ensureWebviewMediaUrl(fallback.value);
    }
}
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
                @error="handleImageError"
            />

            <FileTypeBadge
                :file-path="raw"
                :is-video="isVideo"
                :show-format="width > 100"
                :size="width > 150 ? 'large' : width > 100 ? 'medium' : 'small'"
            />
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

.video-player {
    position: relative;
    width: 100%;
    height: 60vh;
}
</style>
