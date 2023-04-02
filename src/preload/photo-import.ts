import { from } from "rxjs";
import { filter, concatMap, mergeMap } from "rxjs/operators";
import { copyFile } from "./file-helper";
import { ensureDir, scanFolder } from "./path-helper";
import type { ImportCallback, ScanAction, ScanCallback } from "./types";
import log4js from "log4js";
import { electronAPI } from "@electron-toolkit/preload";
import type { FileAction } from "./file-action";

const { ipcRenderer } = electronAPI;

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
                return action.isImage || action.isVideo;
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

export function scanPhotos(scan: ScanAction, callback: ScanCallback): void {
    ipcRenderer.send("picasa:scan-photos", { scanAction: scan });

    ipcRenderer.on("picasa:find-photo", (_, args: FileAction) => {
        callback(args);
    });
}
