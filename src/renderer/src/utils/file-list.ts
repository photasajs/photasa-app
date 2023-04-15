import { useTask } from "vue-concurrency";
import {
    createThumbnailTask,
    isFileUnderFolder,
    removeThumbnailTask,
    addToPhotoList,
    removeFromPhotoList,
    isHiddenFile,
    shouldIgnorePhotasaPath,
} from "@renderer/utils/api";
import type { WatchState, PhotasaConfig } from "src/preload/types";

function isMedia(state: WatchState): boolean {
    return state.isImage || state.isVideo;
}

export const handleAddFileTask = useTask(function* (_, state, photosStore, preferenceStore) {
    return yield handleAddFile(state, photosStore, preferenceStore);
})
    .enqueue()
    .maxConcurrency(1);

async function handleAddFile(state, _, preferenceStore): Promise<void> {
    // Skip hidden or empty path or ignored file
    if (
        !state.isFile ||
        state.path?.length < 0 ||
        isHiddenFile(state.path) ||
        shouldIgnorePhotasaPath(state.path)
    ) {
        return;
    }

    if (isMedia(state)) {
        const request = {
            path: state.path as string,
            thumbnail: state.thumbnail as string,
            width: preferenceStore.thumbnailSize,
            height: preferenceStore.thumbnailSize,
            preview: "",
        };

        await createThumbnailTask.perform(request);

        await addToPhotoList(state.path);

        // if the file is in the current folder, update the current folder config
        // check after replace current folder, if any string still exist
        if (isFileUnderFolder(state.path, preferenceStore.currentFolder)) {
            preferenceStore.addToCurrentPhotasaConfig(request);
        }
    }
}

export const handleDeleteFileTask = useTask(function* (_, state, photosStore, preferenceStore) {
    return yield handleDeleteFile(state, photosStore, preferenceStore);
})
    .enqueue()
    .maxConcurrency(1);

function handleDeleteFile(state, photosStore, preferenceStore): void {
    const { removeFromFileList } = photosStore;
    // Directory skip hidden
    if (!state.isFile || state.path?.length < 0) {
        return;
    }

    if (isMedia(state)) {
        removeThumbnailTask.perform({
            path: state.path as string,
            thumbnail: state.thumbnail,
            width: preferenceStore.thumbnailSize,
            height: preferenceStore.thumbnailSize,
            preview: "",
        });

        removeFromPhotoList(state.path).then((result) => {
            if (isFileUnderFolder(result.path, preferenceStore.currentFolder)) {
                preferenceStore.currentFolderConfig = result.config;
            }
        });

        removeFromFileList({
            path: state.path as string,
            thumbnail: state.thumbnail,
        });

        preferenceStore.removeTreeNodePath(state.path);
    }
}

export const handleChangeFileTask = useTask(function* (_, state, photosStore, preferenceStore) {
    return yield handleDeleteFile(state, photosStore, preferenceStore);
})
    .enqueue()
    .maxConcurrency(1);

function handleChangeFile(state, photosStore, preferenceStore): void {}
