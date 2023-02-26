import { readChunk } from "read-chunk";
import imageType, { minimumBytes, ImageTypeResult } from "image-type";
import isVideo from "is-video";

export async function getImageType(path: string): Promise<ImageTypeResult | undefined> {
    const buffer = await readChunk(path, { length: minimumBytes });
    return await imageType(buffer);
}

export async function isImage(path): Promise<boolean> {
    const type = await getImageType(path);
    return type !== undefined || isVideo(path);
}

export function isVideo(path): boolean {
    return isVideo(path);
}
