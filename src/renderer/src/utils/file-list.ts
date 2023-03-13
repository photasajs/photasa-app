import { useTask } from "vue-concurrency";
import { createThumbnailTask, removeThumbnailTask } from "@renderer/utils/api";
import type { WatchState } from "src/preload/index.d";

function isMedia(state: WatchState): boolean {
    return state.isImage || state.isVideo;
}

export const handleAddFileTask = useTask(function* (_, state, photosStore, preferenceStore) {
    return yield handleAddFile(state, photosStore, preferenceStore);
})
    .enqueue()
    .maxConcurrency(1);

async function handleAddFile(state, photosStore, preferenceStore): Promise<void> {
    const { addFile } = photosStore;
    // Directory skip hidden
    if (!state.isFile) {
        return;
    }

    const path = state.path ?? "";
    // Path is empty skip it.
    if (path.length <= 0) {
        return;
    }

    const parts = path.split("/");

    // Skip any thing start with dot
    const fileName = parts[parts.length - 1];
    if (fileName.startsWith(".") || parts.includes(".picasaoriginals")) {
        return;
    }

    if (isMedia(state)) {
        // state.processingFile.value = state.path ?? "";

        await createThumbnailTask
            .perform({
                path: state.path as string,
                thumbnail: state.thumbnail as string,
                width: preferenceStore.thumbnailSize,
                height: preferenceStore.thumbnailSize,
            })
            .then(() => {
                addFile(preferenceStore.paths, {
                    path: state.path as string,
                    thumbnail: state.thumbnail,
                });
            });
    }
}

export const handleDeleteFileTask = useTask(function* (_, state, photosStore, preferenceStore) {
    return yield handleDeleteFile(state, photosStore, preferenceStore);
})
    .enqueue()
    .maxConcurrency(1);

function handleDeleteFile(state, photosStore, preferenceStore): void {
    const { removeFile, removeFromFileList } = photosStore;
    // Directory skip hidden
    if (!state.isFile) {
        return;
    }

    if (isMedia(state)) {
        removeThumbnailTask.perform({
            path: state.path as string,
            thumbnail: state.thumbnail,
            width: preferenceStore.thumbnailSize,
            height: preferenceStore.thumbnailSize,
        });

        removeFile(preferenceStore.paths, {
            path: state.path as string,
            thumbnail: state.thumbnail,
        });

        removeFromFileList({
            path: state.path as string,
            thumbnail: state.thumbnail,
        });
    }
}
