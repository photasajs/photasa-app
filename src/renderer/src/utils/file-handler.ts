import { useTask } from "vue-concurrency";
import {
    createThumbnailTask,
    isFileUnderFolder,
    removeThumbnailTask,
    addToPhotoList,
    removeFromPhotoList,
    isHiddenFile,
    shouldIgnorePhotasaPath,
    startWatching,
} from "@renderer/utils/api";
import type { WatchState, ThumbnailRequest } from "@common/types";
import { deepCopy } from "./object";

function isMedia(state: WatchState): boolean {
    return state.isImage || state.isVideo;
}

async function handleAddFile(state, preferenceStore): Promise<void> {
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

async function handleDeleteFile(state, preferenceStore): Promise<void> {
    // Directory skip hidden
    if (!state.isFile) {
        preferenceStore.cleanFolderTree(state.path);
        return;
    }

    if (state.path?.length < 0) {
        return;
    }

    if (isMedia(state)) {
        const request = {
            path: state.path as string,
            thumbnail: state.thumbnail,
            width: preferenceStore.thumbnailSize,
            height: preferenceStore.thumbnailSize,
            preview: "",
        } satisfies ThumbnailRequest;
        await removeThumbnailTask.perform(request);

        await removeFromPhotoList(state.path);

        if (isFileUnderFolder(request.path, preferenceStore.currentFolder)) {
            preferenceStore.removeFromCurrentPhotasaConfig(request);
        }
    }
}

async function handleChangeFile(state, preferenceStore): Promise<void> {
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
        // if file is changed, then recreate the thumbnail only
        const request = {
            path: state.path as string,
            thumbnail: state.thumbnail as string,
            width: preferenceStore.thumbnailSize,
            height: preferenceStore.thumbnailSize,
            preview: "",
            always: true,
        } satisfies ThumbnailRequest;

        await createThumbnailTask.perform(request);
    }
    return;
}

const actions = {
    add: handleAddFile,
    change: handleChangeFile,
    delete: handleDeleteFile,
};

export const handleFileTask = useTask(function* (_, state: WatchState, preferenceStore: any) {
    const handler = actions[state.action];
    if (handler) {
        yield handler(state, preferenceStore);
    }
})
    .enqueue()
    .maxConcurrency(1);

export function startFileWatching(dirs: string[], preferenceStore: any): void {
    startWatching(
        {
            path: dirs[0],
            recursive: true,
            paths: deepCopy(dirs),
        },
        (state: WatchState) => {
            handleFileTask.perform(state, preferenceStore);
        },
    );
}
