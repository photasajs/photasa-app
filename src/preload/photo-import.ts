import { of, from, Observable, Subscriber } from "rxjs";
import { map, filter, concatMap, mergeMap, catchError } from "rxjs/operators";
import moment from "moment";
import fs from "fs-extra";
import ExifReader, { StringArrayTag } from "exifreader";
import klaw from "klaw";
import path from "path";
import { readChunk } from "read-chunk";
import imageType, { minimumBytes, ImageTypeResult } from "image-type";

export interface FileAction {
    file: string;
    name: string;
    created?: Date;
    targetName?: string;
    notImage: boolean;
    target?: string;
    targetDir: string;
}

export interface FileException {
    code?: string;
}

function fullPath(filepath, options): string {
    const _options = options || {};
    const root = _options.root;
    return root ? path.join(root, filepath) : filepath;
}

function fileExistsSync(filepath, options?): boolean {
    const _filepath = filepath || "";
    const _options = options || {};
    try {
        return fs.statSync(fullPath(_filepath, _options)).isFile();
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

function copyFile(action): Observable<FileAction> {
    // copy file to target as 年/月/日
    action.targetFileName = path.basename(action.file);
    action.targetFullPath = `${action.targetDir}/${action.targetFileName}`;
    let count = 1;
    let exist = fileExistsSync(action.targetFullPath);
    while (exist) {
        const parts = path.parse(action.targetFullPath);
        action.targetFullPath = `${parts.dir}/${parts.name}_${count}${parts.ext}`;
        exist = fileExistsSync(action.targetFullPath);
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

function ensureDir(action: FileAction): Observable<FileAction> {
    action.targetDir = `${action.target}/${action.targetName}`;
    const promise = new Promise<FileAction>((resolve) => {
        fs.ensureDir(action.targetDir, () => {
            resolve(action);
        });
    });
    return from(promise);
}

export async function getImageType(path: string): Promise<ImageTypeResult | undefined> {
    const buffer = await readChunk(path, { length: minimumBytes });
    return await imageType(buffer);
}

export async function isImage(path): Promise<boolean> {
    const type = await getImageType(path);
    return type !== undefined;
}

async function checkExifDate(filePath: string): Promise<StringArrayTag | undefined> {
    const image = await isImage(filePath);
    return new Promise((resolve, reject) => {
        if (image) {
            fs.readFile(filePath, function (error, data) {
                if (error) {
                    reject(error);
                } else {
                    try {
                        const tags = ExifReader.load(data.buffer);
                        // The MakerNote tag can be really large. Remove it to lower memory
                        // usage if you're parsing a lot of files and saving the tags.
                        delete tags["MakerNote"];
                        resolve(tags["DateTimeDigitized"]);
                    } catch (error) {
                        // Most time. it's not a image file which have exif.
                        resolve(undefined);
                    }
                }
            });
        } else {
            reject(new Error("not supported image"));
        }
    });
}

function resolveExifDate(action: FileAction): Observable<FileAction> {
    const promise = checkExifDate(action.file).then((date) => {
        if (date && date.value[0]) {
            const created = moment(date.value[0], "YYYY:MM:DD hh:mm:ss");
            action.created = created.toDate();
            action.targetName = created.format("YYYY/YYYYMMDD");
        } else {
            const created = moment(action.created);
            action.created = created.toDate();
            action.targetName = created.format("YYYY/YYYYMMDD");
        }

        return action;
    });
    return from(promise).pipe(
        catchError(() => {
            action.notImage = true;
            return of(action);
        }),
    );
}

function scanFolder(source, target): Observable<FileAction> {
    return new Observable<FileAction>((observer: Subscriber<FileAction>) => {
        klaw(source)
            .on("data", (item) => {
                if (!item.stats.isDirectory()) {
                    observer.next({
                        file: item.path,
                        name: path.basename(item.path),
                        created: item.stats.birthtime,
                        target,
                        notImage: false,
                        targetDir: path.dirname(item.path),
                    });
                }
            })
            .on("end", () => {
                observer.complete();
            });
    }).pipe(mergeMap((action: FileAction) => resolveExifDate(action)));
}

export function importPhotos(folders: string[], source: string): Observable<FileAction> {
    return from(folders).pipe(
        map((target) => target[0]),
        mergeMap((folder) => scanFolder(source, folder)),
        filter((action) => !action.notImage),
        mergeMap((action) => ensureDir(action)),
        concatMap((action) => copyFile(action)), // copy file should be concatMap.
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
                        notImage: false,
                    });
                }
            })
            .on("end", () => {
                subscriber.complete();
            });
    });
}
