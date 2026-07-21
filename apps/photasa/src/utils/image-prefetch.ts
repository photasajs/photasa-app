import { useTask } from "vue-concurrency";
import { ensureWebviewMediaUrl } from "@renderer/utils/media-url";

function prefetchImage(src: string): Promise<void> {
    const image = document.createElement("img");
    const loadableSrc = ensureWebviewMediaUrl(src);
    return new Promise((resolve, reject) => {
        image.onload = (): void => resolve();
        image.onerror = reject;
        image.src = loadableSrc;
    });
}

export const prefetchImageTask = useTask(function* (_, imageSrc: string) {
    // 保留 query（如 ?t= 缓存破坏）；剥离会导致「重建缩略图」后 UI 仍显示旧图
    yield prefetchImage(imageSrc);
})
    .enqueue()
    .maxConcurrency(10);
