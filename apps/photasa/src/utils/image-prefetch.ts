import { useTask } from "vue-concurrency";

function prefetchImage(src: string): Promise<void> {
    const image = document.createElement("img");
    return new Promise((resolve, reject) => {
        image.onload = (): void => resolve();
        image.onerror = reject;
        image.src = src;
    });
}

export const prefetchImageTask = useTask(function* (_, imageSrc: string) {
    // RegEx to remove query string
    const src = imageSrc.replace(/\?.*$/, "");
    yield prefetchImage(src);
})
    .enqueue()
    .maxConcurrency(10);
