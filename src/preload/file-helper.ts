import fs from "fs-extra";
import path from "path";
import { Observable, from } from "rxjs";
import { FileAction } from "./file-action";
import { toFullPath } from "./path-helper";

export interface FileException {
    code?: string;
}

export function fileExistSync(filepath, options?): boolean {
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

export function copyFile(action): Observable<FileAction> {
    // copy file to target as 年/月/日
    action.targetFileName = path.basename(action.file);
    action.targetFullPath = `${action.targetDir}/${action.targetFileName}`;
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
            resolve(action);
        }); // copies file
    });

    return from(promise);
}
