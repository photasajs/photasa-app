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
    // RegEx to remove query string
    const src = imageSrc.replace(/\?.*$/, "");
    yield prefetchImage(src);
})
    .enqueue()
    .maxConcurrency(10);
