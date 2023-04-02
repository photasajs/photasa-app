import klaw from "klaw";
import { Observable, Subscriber } from "rxjs";
import isImage from "is-image";
import isVideo from "is-video";
import path from "path";
import type { PhotoPath, ScanAction } from "../preload/types";

function isScanCurrent(action: string): boolean {
    return action == "current" || action == "rescan";
}

export const PHOTASA_ORIGINALS = ".photasaoriginals";

export function buildThumbnailPath(photoPath: string): string {
    // Prepare thumbnail path for image
    const dir = path.join(path.dirname(photoPath), PHOTASA_ORIGINALS);
    return path.join(dir, `thumbnail-${path.basename(photoPath)}.png`);
}

/**
 * Walk through files in a folder and ignore hidden files, photasa files and sub folders.
 */
export function walkthroughPhotos(source: ScanAction): Observable<PhotoPath> {
    return new Observable<PhotoPath>((subscriber: Subscriber<PhotoPath>) => {
        // Only scan current folder
        klaw(source.path, {
            depthLimit: isScanCurrent(source.action) ? 0 : -1,
            filter: (item) => {
                return (
                    !shouldIgnorePhotasaPath(item) && // Skip ignored path
                    !isHiddenFile(item) // Skip hidden file
                );
            },
        })
            .on("data", (item) => {
                const video = isVideo(item.path);
                const image = isImage(item.path);
                if (
                    !item.stats.isDirectory() && // Skip directory
                    item.path !== source.path && //  Skip self
                    (video || image) // Skip non image or video
                ) {
                    subscriber.next({
                        path: item.path,
                        thumbnail: buildThumbnailPath(item.path),
                        isImage: image,
                        isVideo: video,
                    });
                }
            })
            .on("end", () => {
                subscriber.complete();
            });
    });
}

export function isHiddenFile(file: string): boolean {
    const basename = path.basename(file);
    return basename.startsWith(".");
}

export function shouldIgnorePhotasaPath(photoPath: string): boolean {
    return (
        photoPath.indexOf(".photasaoriginals") >= 0 ||
        photoPath.indexOf(".picasaoriginals") >= 0 ||
        photoPath.indexOf(".photasaoriginal") >= 0 ||
        photoPath.indexOf(".picasaoriginal") >= 0 ||
        photoPath.indexOf(".AppleDouble") >= 0
    );
}

export function isFileUnderFolder(file: string, folder: string): boolean {
    const dirname = path.dirname(file);
    return dirname === path.normalize(folder);
}
