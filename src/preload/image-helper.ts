import { readChunk } from "read-chunk";
import imageType, { minimumBytes } from "image-type";
import { electronAPI } from "@electron-toolkit/preload";
import type { ThumbnailRequest, ImageInfo } from "./types";
import { getExifInfo } from "./exif-helper";
import path from "path";

const { ipcRenderer } = electronAPI;

export function buildThumbnailPath(photoPath: string): string {
    // Prepare thumbnail path for image
    const dir = path.join(path.dirname(photoPath), ".photasaoriginals");
    return path.join(dir, `thumbnail-${path.basename(photoPath)}.png`);
}
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

export function removeThumbnail(request: ThumbnailRequest): Promise<ThumbnailRequest> {
    // Start file watching
    return ipcRenderer.invoke("picasa:remove-thumbnail", request);
}
