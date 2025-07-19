<script setup lang="ts">
import { useIntersectionObserver } from "@vueuse/core";
import { onMounted, ref, toRefs, watch } from "vue";
import { prefetchImageTask } from "@renderer/utils/image-prefetch";
import { BaseSpinner } from "@renderer/components/ui";

// Define props and emits
const props = defineProps<{
    src: string;
    height: number;
    width: number;
    fallback: string;
    isVideo: boolean;
    raw: string;
}>();

const { src, height, width, fallback, isVideo } = toRefs(props);
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

.thumbnail-image .ant-image {
    display: flex;
}

.thumbnail-image .ant-spin-nested-loading,
.thumbnail-image .ant-spin-container {
    background: transparent !important;
}

.video-player {
    position: relative;
    width: 100%;
    height: 60vh;
}
</style>
