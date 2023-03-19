import { useTask } from "vue-concurrency";
import { createThumbnailTask, scanPhotos, updatePhotoList } from "@renderer/utils/api";
import type { PhotasaConfig, PhotoPath, ScanCallback } from "src/preload/types";

export type ScanArgs = {
    type: "next" | "error" | "complete";
    action?: PhotoPath;
    error?: {
        message: string;
    };
};

export const processScannedFileTask = useTask(function* (_, args: ScanArgs, thumbnailSize: number) {
    if (!args.action?.path) {
        return;
    }

    yield createThumbnailTask.perform({
        path: args.action?.path as string,
        thumbnail: args.action?.thumbnail as string,
        width: thumbnailSize,
        height: thumbnailSize,
    });

    // Save to .photasa.json
    return yield updatePhotoList(args.action.path);
})
    .enqueue()
    .maxConcurrency(1);

export const scanPhotosTask = useTask(function* (_, folder: string, callback: ScanCallback) {
    yield scanPhotos(folder, callback);
})
    .enqueue()
    .maxConcurrency(1);
