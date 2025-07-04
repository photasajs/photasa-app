<script setup lang="ts">
import { ref, watch } from "vue";
import VueEasyLightbox from "./LightBox";

const props = defineProps<{
    images: Array<{ src: string; w: number; h: number; title?: string }>;
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
    emit("change", newIndex);
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
                :src="currentImg.src"
                :poster="currentImg.thumbnail"
                :width="currentImg.w"
                :height="currentImg.h"
            ></video-player>
            <img v-else :src="currentImg.src" data-src="currentImg.src" />
        </template>
    </VueEasyLightbox>
</template>
