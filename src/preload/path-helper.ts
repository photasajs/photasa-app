import klaw from "klaw";
import path from "path";
import type { FileAction } from "./types";
import { from, map, mergeMap, Observable, Subscriber } from "rxjs";
import fs from "fs-extra";
import { resolveExifDate } from "./exif-helper";
import isImage from "is-image";
import isVideo from "is-video";
import { buildThumbnailPath, shouldIgnorePhotasaPath, isHiddenFile } from "../common";
import type { PhotoPath, ScanAction } from "./types";
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

function isScanCurrent(action: string): boolean {
    return action == "current" || action == "rescan";
}

/**
 * Walk through files in a folder and ignore hidden files, photasa files and sub folders.
 */
export function walkthroughFiles(source: ScanAction): Observable<PhotoPath> {
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
                if (
                    !item.stats.isDirectory() && // Skip directory
                    item.path !== source.path //  Skip self
                ) {
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
