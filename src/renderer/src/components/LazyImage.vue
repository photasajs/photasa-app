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

// 仅视频支持点击弹窗，图片不再有 antd 预览
const videoPlayerIsVisible = ref(false);
function handleImageClick(): void {
    if (isVideo.value) {
        videoPlayerIsVisible.value = true;
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
                @click="handleImageClick()"
            />
        </a-spin>
    </div>
    <a-modal v-model:visible="videoPlayerIsVisible" width="100%" wrap-class-name="full-modal">
        <video-player
            v-if="isVideo"
            :class="['video-player', 'vjs-big-play-centered']"
            :src="raw"
            playsinline
            controls
            :loop="true"
            :volume="0.6"
        />
        <template #footer></template>
    </a-modal>
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
