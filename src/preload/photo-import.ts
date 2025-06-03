import { from } from "rxjs";
import { filter, concatMap, mergeMap } from "rxjs/operators";
import { copyFile } from "./file-helper";
import { ensureDir, scanFolder } from "./path-helper";
import type { FileAction, ImportCallback, ScanAction, ScanArgs } from "./types";
import log4js from "log4js";
import { electronAPI } from "@electron-toolkit/preload";

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
                    error: null,
                    action,
                });
            },
            error: (error) => {
                logger.debug("error", error);
                callback({
                    type: "error",
                    error,
                    action: <FileAction>{},
                });
            },
            complete: () => {
                logger.debug("complete");
                callback({
                    type: "complete",
                    error: null,
                    action: <FileAction>{},
                });
            },
        });
}

const RequestQueue = {
    promiseQueue: {},
    sequenceId: 0,
};

ipcRenderer.on("picasa:find-photo", (_, args: ScanArgs) => {
    if (args.type === "complete") {
        const requestId = args.requestId;
        if (RequestQueue.promiseQueue[requestId]) {
            RequestQueue.promiseQueue[requestId](args);
            delete RequestQueue.promiseQueue[requestId];
        }
    }
});

export function scanPhotos(scan: ScanAction): Promise<void> {
    console.log("scanPhotos called with scan action:", scan);
    return new Promise((resolve) => {
        const requestId = `scan-${RequestQueue.sequenceId++}`;
        console.log("Created request ID:", requestId);
        RequestQueue.promiseQueue[requestId] = resolve;
        ipcRenderer.send("picasa:scan-photos", {
            requestId,
            scanAction: scan,
        });
    });
}
