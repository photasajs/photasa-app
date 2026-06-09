<script setup lang="ts">
import { ref, watch } from "vue";
import VueEasyLightbox from "./LightBox";
import { BaseImage } from "@renderer/components/ui";
import fallbackImage from "@renderer/assets/images/fallback.png";

const IMAGE_LOAD_FALLBACK =
    process.env.NODE_ENV === "test"
        ? "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A"
        : fallbackImage;

const props = defineProps<{
    images: Array<{
        src: string;
        w: number;
        h: number;
        title?: string;
        isVideo?: boolean;
        raw?: string;
        thumbnail?: string;
        preview?: string;
    }>;
    index: number;
    visible: boolean;
}>();
const emit = defineEmits(["close", "change"]);

const show = ref(props.visible);
const currentIndex = ref(props.index);

watch(
    () => props.visible,
    (val) => {
        show.value = val;
    },
);
watch(
    () => props.index,
    (val) => {
        currentIndex.value = val;
    },
);

function handleHide() {
    emit("close");
}
function handleOnIndexChange(newIndex: number) {
    // 只在索引实际变化时才 emit，防止递归死循环
    if (newIndex !== currentIndex.value) {
        emit("change", newIndex);
    }
}
</script>
<template>
    <VueEasyLightbox
        :visible="show"
        :imgs="images"
        :index="currentIndex"
        @hide="handleHide"
        @on-index-change="handleOnIndexChange"
    >
        <template #default="{ currentImg }">
            <div v-if="currentImg.isVideo" class="media-preview-video-wrap">
                <video-player
                    :class="['vjs-big-play-centered']"
                    :src="currentImg.raw"
                    :poster="currentImg.thumbnail"
                    :width="currentImg.w"
                    :height="currentImg.h"
                    playsinline
                    controls
                    :loop="true"
                    :volume="0.6"
                />
            </div>
            <BaseImage
                v-else
                :src="currentImg.preview || currentImg.raw || ''"
                :preview="currentImg.preview"
                :width="currentImg.w"
                :height="currentImg.h"
                :fallback="IMAGE_LOAD_FALLBACK"
                :fallback-to-thumbnail="false"
                :eager-load="true"
                :fit-viewport="true"
                :isVideo="false"
                :raw="currentImg.raw || ''"
                :alt="currentImg.title"
            />
        </template>
    </VueEasyLightbox>
</template>
<style scoped lang="less">
.media-preview-video-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 80vw;
    max-height: 80vh;

    :deep(.video-js) {
        max-width: 80vw;
        max-height: 80vh;
        width: 100%;
        height: auto;
    }
}
</style>
