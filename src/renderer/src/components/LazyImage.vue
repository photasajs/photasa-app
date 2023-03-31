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
        <a-spin :spinning="targetIsVisible && !isReady">
            <a-image
                v-if="targetIsVisible && isReady"
                :width="width"
                :height="height"
                :src="actualSrc"
                :fallback="fallback"
                :preview="{
                    src: preview,
                }"
                :style="{ margin: 'auto' }"
            />
        </a-spin>
    </div>
</template>
<style lang="less">
.thumbnail-image .ant-image {
    display: flex;
}
</style>
