import klaw from "klaw";
import path from "path";
import type { FileAction } from "./file-action";
import { from, map, mergeMap, Observable, Subscriber } from "rxjs";
import fs from "fs-extra";
import { resolveExifDate } from "./exif-helper";
import isImage from "is-image";

export interface PathOption {
    root?: string;
}

export interface FileException {
    code?: string;
}

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
                        targetDir: "",
                    });
                }
            })
            .on("end", () => {
                subscriber.complete();
            });
    }).pipe(
        map((action: FileAction) => {
            action.isImage = isImage(action.file);
            return action;
        }),
        mergeMap((action: FileAction) => resolveExifDate(action)),
    );
}

export function scanCurrentFolder(source, depth): Observable<FileAction> {
    return new Observable<FileAction>((subscriber: Subscriber<FileAction>) => {
        klaw(source, { depthLimit: depth || 1 })
            .on("data", (item) => {
                if (item.stats.isDirectory() && item.path != source) {
                    subscriber.next({
                        file: item.path,
                        name: path.basename(item.path),
                        created: item.stats.birthtime,
                        targetDir: path.dirname(item.path),
                        isImage: isImage(item.path),
                    });
                }
            })
            .on("end", () => {
                subscriber.complete();
            });
    });
}
