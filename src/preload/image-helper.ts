import { readChunk } from "read-chunk";
import imageType, { minimumBytes } from "image-type";
import { electronAPI } from "@electron-toolkit/preload";
import type { ThumbnailRequest, ImageInfo } from "./index.d";
import { getExifInfo } from "./exif-helper";
const { ipcRenderer } = electronAPI;

export async function getImageType(path: string): Promise<ImageInfo> {
    const buffer = await readChunk(path, { length: minimumBytes });
    const tags = await getExifInfo(path);
    const result = await imageType(buffer);
    return {
        imageType: result,
        tags,
    };
}

export function createThumbnail(request: ThumbnailRequest): Promise<ThumbnailRequest> {
    // Start file watching
    return ipcRenderer.invoke("picasa:create-thumbnail", request);
}
