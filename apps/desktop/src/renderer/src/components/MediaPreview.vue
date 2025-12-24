<script setup lang="ts">
import { ref, watch } from "vue";
import VueEasyLightbox from "./LightBox";
import { BaseImage } from "@renderer/components/ui";

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
            <video-player
                v-if="currentImg.isVideo"
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
            <BaseImage
                v-else
                :src="currentImg.preview || currentImg.raw"
                :width="currentImg.w"
                :height="currentImg.h"
                :fallback="currentImg.thumbnail || ''"
                :isVideo="false"
                :raw="currentImg.raw"
                :alt="currentImg.title"
                style="max-width: 100%; max-height: 80vh"
            />
        </template>
    </VueEasyLightbox>
</template>
