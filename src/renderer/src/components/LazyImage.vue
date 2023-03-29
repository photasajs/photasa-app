<script setup lang="ts">
import { UseElementVisibility } from "@vueuse/components";
import { onMounted, ref, toRefs, watch } from "vue";
import { prefetchImageTask } from "@renderer/utils/image-prefetch";

// Define props and emits
const props = defineProps<{
    src: string;
    height: number;
    width: number;
    preview: string;
    fallback: string;
}>();

const { src, height, width, preview, fallback } = toRefs(props);
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
</script>

<template>
    <UseElementVisibility
        v-slot="{ isVisible }"
        :style="{
            width: width + 'px',
            height: height + 'px',
        }"
    >
        <a-image
            v-if="isVisible && isReady"
            :width="width"
            :height="height"
            :src="actualSrc"
            :fallback="fallback"
            :preview="{
                src: preview,
            }"
        />
    </UseElementVisibility>
</template>
