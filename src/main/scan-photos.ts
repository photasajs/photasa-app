import klaw from "klaw";
import { Observable, Subscriber, concatMap } from "rxjs";
import isImage from "is-image";
import isVideo from "is-video";
import path from "path";
import type { PhotoPath, ScanAction } from "../preload/types";
import { createThumbnail } from "./thumbnail";
import { addToPhotasaConfig } from "./config-storage";
import type { Logger } from "log4js";

export const PHOTASA_ORIGINALS = ".photasaoriginals";

/**
 * Whether only scan current folder or scan all sub folders.
 */
function shouldScanOneLevel(action: string): boolean {
    return action == "current" || action == "rescan" || action == "scan";
}

export function buildThumbnailPath(photoPath: string): string {
    // Prepare thumbnail path for image
    const dir = path.join(path.dirname(photoPath), PHOTASA_ORIGINALS);
    return path.join(dir, `thumbnail-${path.basename(photoPath)}.png`);
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
        photoPath.indexOf(".AppleDouble") >= 0 ||
        photoPath.indexOf(".DS_Store") >= 0 ||
        photoPath.indexOf("983db650f7f79bc8e87d9a3ba418aefc") >= 0
    );
}

export function isFileUnderFolder(file: string, folder: string): boolean {
    const dirname = path.dirname(file);
    return dirname === path.normalize(folder);
}

/**
 * Walk through files in a folder and ignore hidden files, photasa files and sub folders.
 */
export function walkthroughPhotos(source: ScanAction): Observable<PhotoPath> {
    return new Observable<PhotoPath>((subscriber: Subscriber<PhotoPath>) => {
        // Only scan current folder
        const option = {
            depthLimit: shouldScanOneLevel(source.action) ? 0 : -1,
            filter: (item: string): boolean => {
                return (
                    !shouldIgnorePhotasaPath(item) && // Skip ignored path
                    !isHiddenFile(item) // Skip hidden file
                );
            },
        };
        klaw(source.path, option)
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

export function scanPhotos(scan: ScanAction, logger: Logger): Observable<PhotoPath> {
    return walkthroughPhotos(scan).pipe(
        concatMap((action: PhotoPath) => {
            return createThumbnail(
                {
                    path: action.path,
                    thumbnail: action.thumbnail,
                    width: scan.thumbnailSize,
                    height: scan.thumbnailSize,
                    preview: "",
                },
                logger,
            ).then(() => action);
        }),
        concatMap((action: PhotoPath) => {
            addToPhotasaConfig(
                {
                    queueId: 0,
                    paths: [action.path],
                },
                () => {},
                logger,
            );
            return Promise.resolve(action);
        }),
    );
}
