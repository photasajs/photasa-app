import path from "path";

export const PHOTASA_ORIGINALS = ".photasaoriginals";

export function buildThumbnailPath(photoPath: string): string {
    // Prepare thumbnail path for image
    const dir = path.join(path.dirname(photoPath), PHOTASA_ORIGINALS);
    return path.join(dir, `thumbnail-${path.basename(photoPath)}.png`);
}

export function toRelativeThumbnailPath(photoPath: string): string {
    return path.join(PHOTASA_ORIGINALS, `thumbnail-${path.basename(photoPath)}.png`);
}
