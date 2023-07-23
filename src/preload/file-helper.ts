import fs from "fs-extra";
import path from "path";
import { Observable, from } from "rxjs";
import type { FileAction, FileException } from "./types";
import { PathOption, toFullPath } from "./path-helper";

export function fileExistSync(filepath: string, options?: PathOption): boolean {
    const _filepath = filepath || "";
    const _options = options || {};
    try {
        return fs.statSync(toFullPath(_filepath, _options)).isFile();
    } catch (e) {
        const err = <FileException>e;
        // Check exception. If ENOENT - no such file or directory ok, file doesn't exist.
        // Otherwise something else went wrong, we don't have rights to access the file, ...
        if (err.code != "ENOENT") {
            throw err;
        }

        return false;
    }
}

export function copyFile(action: FileAction): Observable<FileAction> {
    // copy file to target as 年/月/日
    action.targetFileName = path.basename(action.file);
    action.targetFullPath = path.join(action.targetDir, action.targetFileName);
    let count = 1;
    let exist = fileExistSync(action.targetFullPath);
    while (exist) {
        const parts = path.parse(action.targetFullPath);
        action.targetFullPath = `${parts.dir}/${parts.name}_${count}${parts.ext}`;
        exist = fileExistSync(action.targetFullPath);
        count++;
    }
    // fs.copyFile
    const promise = new Promise<FileAction>((resolve, reject) => {
        fs.copy(action.file, action.targetFullPath, (err) => {
            if (err) {
                reject(err);
                return;
            }
            // Keep original time
            const stat = fs.statSync(action.file);
            fs.utimesSync(action.targetFullPath, stat.atime, stat.mtime);
            resolve(action);
        }); // copies file
    });

    return from(promise);
}
