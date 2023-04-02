<script setup lang="ts">
import { useIntersectionObserver } from "@vueuse/core";
import { onMounted, ref, toRefs, watch } from "vue";
import { prefetchImageTask } from "@renderer/utils/image-prefetch";

// Define props and emits
const props = defineProps<{
    src: string;
    height: number;
    width: number;
    preview: string;
    fallback: string;
    isVideo: boolean;
}>();

const { src, height, width, preview, fallback, isVideo } = toRefs(props);
const isReady = ref(false);
const actualSrc = ref("");

watch(src, () => {
    isReady.value = false;
    prefetchImage(src.value);
});

async function prefetchImage(imageSrc: string): Promise<void> {
    try {
        await prefetchImageTask.perform(imageSrc);
    } catch {
        /* empty */
    }
    isReady.value = true;
    actualSrc.value = imageSrc;
}

onMounted(() => {
    prefetchImage(src.value);
});

const target = ref(null);
const targetIsVisible = ref(false);

useIntersectionObserver(target, ([{ isIntersecting }]) => {
    targetIsVisible.value = isIntersecting;
});

const previewIsVisible = ref(false);
const videoPlayerIsVisible = ref(false);
function handleImageClick(): void {
    if (isVideo.value) {
        previewIsVisible.value = true;
    } else {
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
        <a-spin :spinning="targetIsVisible && !isReady">
            <a-image
                v-if="targetIsVisible && isReady"
                :width="width"
                :height="height"
                :src="actualSrc"
                :fallback="fallback"
                :preview="{
                    src: preview,
                    visible: previewIsVisible,
                }"
                :style="{ margin: 'auto' }"
                @click="handleImageClick()"
            />
        </a-spin>
    </div>
    <a-modal v-model:visible="videoPlayerIsVisible" width="100%" wrap-class-name="full-modal">
        <video-player :src="src" :poster="fallback" controls :loop="true" :volume="0.6" />
    </a-modal>
</template>
<style lang="less">
.thumbnail-image .ant-image {
    display: flex;
}
.full-modal {
    .ant-modal {
        max-width: 100%;
        top: 0;
        padding-bottom: 0;
        margin: 0;
    }
    .ant-modal-content {
        display: flex;
        flex-direction: column;
        height: calc(100vh);
    }
    .ant-modal-body {
        flex: 1;
    }
}
</style>
