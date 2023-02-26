import { of, from, Observable } from "rxjs";
import { catchError } from "rxjs/operators";
import moment from "moment";
import fs from "fs-extra";
import ExifReader, { StringArrayTag } from "exifreader";
import { isImage } from "./image-helper";
import { FileAction } from "./file-action";

export async function checkExifDate(filePath: string): Promise<StringArrayTag | undefined> {
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

export function resolveExifDate(action: FileAction): Observable<FileAction> {
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
            action.isImage = false;
            return of(action);
        }),
    );
}
