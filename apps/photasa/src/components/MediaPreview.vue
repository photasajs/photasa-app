<script setup lang="ts">
import { ref, watch } from "vue";
import VueEasyLightbox from "./LightBox";
import { ensureWebviewMediaUrl } from "@renderer/utils/media-url";
import posthog from "posthog-js";

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
        if (val) {
            const current = props.images[props.index];
            posthog.capture("media_preview_opened", {
                media_type: current?.isVideo ? "video" : "image",
            });
        }
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
    if (newIndex !== currentIndex.value) {
        emit("change", newIndex);
    }
}
function handleImageError(event: Event, fallback?: string): void {
    const img = event.target as HTMLImageElement | null;
    if (img && fallback) {
        img.src = ensureWebviewMediaUrl(fallback);
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
                :src="ensureWebviewMediaUrl(currentImg.raw)"
                :poster="ensureWebviewMediaUrl(currentImg.thumbnail || '')"
                :width="currentImg.w"
                :height="currentImg.h"
                playsinline
                controls
                :loop="true"
                :volume="0.6"
            />
            <img
                v-else
                :src="ensureWebviewMediaUrl(currentImg.preview || currentImg.raw)"
                :alt="currentImg.title || 'Image'"
                class="max-w-[85vw] max-h-[80vh] object-contain rounded-md shadow-2xl block m-auto"
                @error="(e) => handleImageError(e, currentImg.thumbnail)"
            />
        </template>
    </VueEasyLightbox>
</template>
