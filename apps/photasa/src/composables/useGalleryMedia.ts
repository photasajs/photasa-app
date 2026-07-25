import type { FileMetadata, ThumbnailRequest, ThumbnailResponse } from "@photasa/common";
import { useTask } from "vue-concurrency";
import { useWeiZheng } from "./useWeiZheng";

export interface GalleryMediaComposable {
    createThumbnail(request: ThumbnailRequest): Promise<ThumbnailResponse>;
    fileMetadata(path: string): Promise<FileMetadata>;
    filesModified(paths: string[]): Promise<Record<string, number>>;
}

export function useGalleryMedia(): GalleryMediaComposable {
    const gallery = useWeiZheng().gallery;
    const createThumbnailTask = useTask(function* (_, request: ThumbnailRequest) {
        return yield gallery.createThumbnail(request);
    })
        .enqueue()
        .maxConcurrency(2);

    return {
        createThumbnail: async (request) => await createThumbnailTask.perform(request),
        fileMetadata: (path) => gallery.fileMetadata(path),
        filesModified: (paths) => gallery.filesModified(paths),
    };
}
