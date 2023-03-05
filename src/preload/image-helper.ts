import { readChunk } from "read-chunk";
import imageType, { minimumBytes, ImageTypeResult } from "image-type";
import isVideo from "is-video";
import { electronAPI } from "@electron-toolkit/preload";
import type { ThumbnailRequest } from "./index.d";

const { ipcRenderer } = electronAPI;

export async function getImageType(path: string): Promise<ImageTypeResult | undefined> {
    const buffer = await readChunk(path, { length: minimumBytes });
    return await imageType(buffer);
}

export function createThumbnail(request: ThumbnailRequest): Promise<ThumbnailRequest> {
    // Start file watching
    return ipcRenderer.invoke("picasa:create-thumbnail", request);
}
