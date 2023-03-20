import { from } from "rxjs";
import { filter, concatMap, mergeMap } from "rxjs/operators";
import { copyFile } from "./file-helper";
import {
    ensureDir,
    scanFolder,
    walkthroughFolder,
    shouldIgnorePhotasaPath,
    isHiddenFile,
} from "./path-helper";
import type { ImportCallback, ScanCallback } from "./types";
import log4js from "log4js";

const logger = log4js.getLogger("photo-import");
/**
 * Import photos from folders
 *
 * @param folders  folders to import
 * @param target target folder to save
 * @param callback callback function to info the state
 */
export function importPhotos(folders: string[], target: string, callback: ImportCallback): void {
    from(folders)
        .pipe(
            mergeMap((folder) => scanFolder(folder, target)),
            filter((action) => {
                return (
                    (action.isImage || action.isVideo) && // Image or video
                    !shouldIgnorePhotasaPath(action.file) && // Not in ignore list such as .photasaoriginals or .picasaoriginals
                    !isHiddenFile(action.file)
                );
            }),
            mergeMap((action) => ensureDir(action)),
            concatMap((action) => copyFile(action)), // copy file should be concatMap.
        )
        .subscribe({
            next: (action) => {
                logger.debug("next", action);
                callback({
                    type: "next",
                    action,
                });
            },
            error: (error) => {
                logger.debug("error", error);
                callback({
                    type: "error",
                    error,
                });
            },
            complete: () => {
                logger.debug("complete");
                callback({
                    type: "complete",
                });
            },
        });
}

export function scanPhotos(folder: string, callback: ScanCallback): void {
    walkthroughFolder(folder)
        .pipe(filter((action) => action.isImage || action.isVideo))
        .subscribe({
            next: (action) => {
                logger.debug("next", action);
                if (!shouldIgnorePhotasaPath(action.path) && !isHiddenFile(action.path)) {
                    callback({
                        type: "next",
                        action,
                    });
                }
            },
            error: (error) => {
                logger.debug("error", error);
                callback({
                    type: "error",
                    error,
                });
            },
            complete: () => {
                logger.debug("complete");
                callback({
                    type: "complete",
                });
            },
        });
}
