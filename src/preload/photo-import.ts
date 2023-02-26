import { from, Observable } from "rxjs";
import { filter, concatMap, mergeMap } from "rxjs/operators";
import { copyFile } from "./file-helper";
import { ensureDir, scanFolder } from "./path-helper";
import type { FileAction } from "./file-action";

export type ImportCallback = (action: FileAction | string | undefined) => void;

/**
 * Import photos from folders
 *
 * @param folders  folders to import
 * @param target target folder to save
 * @returns Observable<FileAction>
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
                callback(action);
            },
            error: (error) => callback(error.message),
            complete: () => {
                callback(undefined);
            },
        });
}
