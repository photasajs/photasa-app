<script setup lang="ts">
import { useIntersectionObserver } from "@vueuse/core";
import { onMounted, ref, toRefs, watch } from "vue";
import { prefetchImageTask } from "@renderer/utils/image-prefetch";

// Define props and emits
const props = defineProps<{
    src: string;
    height: number;
    width: number;
    fallback: string;
    isVideo: boolean;
    raw: string;
}>();

const { src, raw, height, width, fallback, isVideo } = toRefs(props);
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
    isLoading.value = true;
    prefetchImage(src.value);
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
        <a-spin :spinning="targetIsVisible && isLoading">
            <a-image
                v-if="targetIsVisible && isReady"
                :width="width"
                :height="height"
                :src="actualSrc"
                :fallback="fallback"
                :style="{
                    margin: 'auto',
                    objectFit: 'contain',
                    width: width + 'px',
                    height: height + 'px',
                    display: 'block',
                }"
                :preview="false"
            />
        </a-spin>
    </div>
</template>
<style lang="less">
.thumbnail-image .ant-image {
    display: flex;
}
.video-player {
    position: relative;
    width: 100%;
    height: 60vh;
}
</style>
