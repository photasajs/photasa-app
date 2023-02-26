import { from } from "rxjs";
import { filter, concatMap, mergeMap } from "rxjs/operators";
import { copyFile } from "./file-helper";
import { ensureDir, scanFolder } from "./path-helper";
import type { ImportCallback } from "./index.d";

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
            filter((action) => action.isImage),
            mergeMap((action) => ensureDir(action)),
            concatMap((action) => copyFile(action)), // copy file should be concatMap.
        )
        .subscribe({
            next: (action) => {
                callback({
                    type: "next",
                    action,
                });
            },
            error: (error) =>
                callback({
                    type: "error",
                    error,
                }),
            complete: () => {
                callback({
                    type: "complete",
                });
            },
        });
}
