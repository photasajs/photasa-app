import { useTask } from "vue-concurrency";
import { createThumbnailTask, scanPhotos, addToPhotoList } from "@renderer/utils/api";
import type { ScanAction, ScanArgs } from "src/preload/types";

export const processScannedFileTask = useTask(function* (_, args: ScanArgs, thumbnailSize: number) {
    if (!args.action?.path) {
        return;
    }

    // Create a thumbnail
    yield createThumbnailTask.perform({
        path: args.action?.path as string,
        thumbnail: args.action?.thumbnail as string,
        width: thumbnailSize,
        height: thumbnailSize,
        preview: "",
    });

    // Save to .photasa.json
    addToPhotoList(args.action.path);
})
    .enqueue()
    .maxConcurrency(1);

export const scanPhotosTask = useTask(function* (_, folder: ScanAction) {
    return yield scanPhotos(folder);
})
    .enqueue()
    .maxConcurrency(1);
