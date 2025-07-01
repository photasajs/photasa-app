<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref, nextTick } from "vue";
import PhotoSwipe from "photoswipe";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";

const props = defineProps<{
    images: Array<{ src: string; w: number; h: number; title?: string }>;
    index: number;
    visible: boolean;
}>();
const emit = defineEmits(["close", "change"]);

let lightbox: PhotoSwipeLightbox | null = null;
const container = ref<HTMLElement | null>(null);

// 顶部安全区高度，MacOS 32px，Win/Linux 0
const safeAreaTop = ref(0);

function detectPlatformSafeArea() {
    let isMac = false;
    try {
        isMac = (window as any)?.process?.platform === "darwin";
    } catch {}
    if (!isMac) {
        isMac = /Macintosh|MacIntel|MacPPC|Mac68K/i.test(navigator.userAgent);
    }
    safeAreaTop.value = isMac ? 32 : 0;
}

function openLightbox(idx: number) {
    if (lightbox) {
        lightbox.loadAndOpen(idx);
    }
}

watch(
    () => props.visible,
    (val) => {
        if (val) {
            openLightbox(props.index);
        } else {
            lightbox?.pswp?.close();
        }
    },
);

function injectSafeAreaStyle() {
    const styleId = "pswp-safe-area-style";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
            :root { --pswp-safe-area-top: ${safeAreaTop.value}px; }
            /* PhotoSwipe 根元素整体下移，彻底避开 app bar */
            .pswp {
                position: fixed !important;
                top: var(--pswp-safe-area-top, 32px) !important;
                left: 0 !important;
                width: 100vw !important;
                height: calc(100vh - var(--pswp-safe-area-top, 32px)) !important;
                z-index: 1500 !important;
            }
        `;
        document.head.appendChild(style);
    }
}

onMounted(() => {
    detectPlatformSafeArea();
    nextTick(() => {
        injectSafeAreaStyle();
    });
    lightbox = new PhotoSwipeLightbox({
        gallery: container.value!,
        children: "a",
        pswpModule: PhotoSwipe,
        dataSource: props.images,
        index: props.index,
        showHideAnimationType: "zoom",
        bgOpacity: 0.9,
        wheelToZoom: true,
        closeOnVerticalDrag: true,
        maxZoomLevel: 4,
        padding: { top: 40, bottom: 40, left: 20, right: 20 },
    });
    lightbox.on("close", () => emit("close"));
    lightbox.on("change", () => emit("change", lightbox?.pswp?.currIndex ?? 0));
    if (props.visible) {
        openLightbox(props.index);
    }
    lightbox.init();
});

onBeforeUnmount(() => {
    lightbox?.destroy();
    lightbox = null;
});
</script>
<template>
    <div ref="container" style="display: none">
        <a
            v-for="(img, i) in images"
            :key="i"
            :href="img.src"
            :data-pswp-width="img.w"
            :data-pswp-height="img.h"
            :data-pswp-title="img.title"
        />
    </div>
</template>

<style lang="less">
:deep(.pswp) {
    position: fixed !important;
    top: var(--pswp-safe-area-top, 32px) !important;
    left: 0 !important;
    width: 100vw !important;
    height: calc(100vh - var(--pswp-safe-area-top, 32px)) !important;
    z-index: 1500 !important;
}
</style>
