import klaw from "klaw";
import path from "path";
import type { FileAction } from "./file-action";
import { from, map, mergeMap, Observable, Subscriber } from "rxjs";
import fs from "fs-extra";
import { resolveExifDate } from "./exif-helper";
import isImage from "is-image";
import isVideo from "is-video";
import { buildThumbnailPath } from "./image-helper";
import type { PhotoPath } from "./types";

export interface PathOption {
    root?: string;
}

export interface FileException {
    code?: string;
}


/**
 * Return path combined with root
 * @param filepath
 * @param options
 * @returns
 */
export function toFullPath(filepath: string, options: PathOption): string {
    const _options = options || {};
    const root = _options.root;
    return root ? path.join(root, filepath) : filepath;
}

export function ensureDir(action: FileAction): Observable<FileAction> {
    action.targetDir = path.join(action.target ?? "", action.targetName ?? "");
    const promise = new Promise<FileAction>((resolve) => {
        fs.ensureDir(action.targetDir, () => {
            resolve(action);
        });
    });
    return from(promise);
}

export function scanFolder(source: string, target: string): Observable<FileAction> {
    return new Observable<FileAction>((subscriber: Subscriber<FileAction>) => {
        klaw(source)
            .on("data", (item) => {
                if (!item.stats.isDirectory()) {
                    subscriber.next({
                        file: item.path,
                        name: path.basename(item.path),
                        created: item.stats.birthtime,
                        target,
                        isImage: false,
                        isVideo: false,
                        targetDir: "",
                        targetFileName: "",
                        targetFullPath: "",
                    });
                }
            })
            .on("end", () => {
                subscriber.complete();
            });
    }).pipe(
        map((action: FileAction) => {
            action.isImage = isImage(action.file);
            action.isVideo = isVideo(action.file);
            return action;
        }),
        mergeMap((action: FileAction) => resolveExifDate(action)),
    );
}

export function walkthroughFolder(source: string): Observable<PhotoPath> {
    return new Observable<PhotoPath>((subscriber: Subscriber<PhotoPath>) => {
        klaw(source)
            .on("data", (item) => {
                if (!item.stats.isDirectory() && item.path != source) {
                    subscriber.next({
                        path: item.path,
                        thumbnail: buildThumbnailPath(item.path),
                        isImage: isImage(item.path),
                        isVideo: isVideo(item.path),
                    });
                }
            })
            .on("end", () => {
                subscriber.complete();
            });
    });
}
