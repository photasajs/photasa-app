import { useTask } from "vue-concurrency";
import {
    createThumbnailTask,
    isFileUnderFolder,
    removeThumbnailTask,
    addToPhotoList,
    removeFromPhotoList,
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

async function handleAddFile(state, photosStore, preferenceStore): Promise<void> {
    const { addPhotasaConfigFile } = photosStore;
    // Directory skip hidden or empty path
    if (!state.isFile || state.path?.length < 0) {
        return;
    }

    const parts = (state.path ?? "").split("/");

    // Skip any thing start with dot
    const fileName = parts[parts.length - 1];
    if (fileName.startsWith(".") || parts.includes(".picasaoriginals")) {
        return;
    }

    if (isMedia(state)) {
        await createThumbnailTask
            .perform({
                path: state.path as string,
                thumbnail: state.thumbnail as string,
                width: preferenceStore.thumbnailSize,
                height: preferenceStore.thumbnailSize,
            })
            .then(() => {
                return addToPhotoList(state.path);
            })
            .then((result: { path: string; config: PhotasaConfig }) => {
                // if the file is in the current folder, update the current folder config
                // check after replace current folder, if any string still exist
                if (isFileUnderFolder(result.path, preferenceStore.currentFolder)) {
                    preferenceStore.currentFolderConfig = result.config;
                }
                addPhotasaConfigFile(preferenceStore.paths, {
                    path: result.path,
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
    }
}
