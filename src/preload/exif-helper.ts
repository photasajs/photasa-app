import { of, from, Observable } from "rxjs";
import { catchError } from "rxjs/operators";
import moment from "moment";
import fs from "fs-extra";
import ExifReader, { Tags, XmpTags, IccTags, StringArrayTag, ExifTags } from "exifreader";
import isImage from "is-image";
import type { FileAction } from "@common/types";

/**
 * 获取图片的 EXIF 信息
 * @param path 图片路径
 * @returns 图片的 EXIF 信息
 */
export function getExifInfo(path: string): Promise<Tags | XmpTags | IccTags | undefined> {
    return new Promise((resolve, reject) => {
        fs.readFile(path, function (error, data) {
            if (error) {
                reject(error);
            } else {
                try {
                    const tags = ExifReader.load(data.buffer);
                    // The MakerNote tag can be really large. Remove it to lower memory
                    // usage if you're parsing a lot of files and saving the tags.
                    delete tags["MakerNote"];
                    resolve(tags);
                } catch (error) {
                    // Most time. it's not a image file which have exif.
                    resolve(undefined);
                }
            }
        });
    });
}

/**
 * 检查图片的 EXIF 日期
 * @param filePath 图片路径
 * @returns 图片的 EXIF 日期
 */
export async function checkExifDate(filePath: string): Promise<StringArrayTag | undefined> {
    const image = isImage(filePath);
    return new Promise((resolve, reject) => {
        if (image) {
            fs.readFile(filePath, function (error, data) {
                if (error) {
                    reject(error);
                } else {
                    try {
                        const tags = <ExifTags>ExifReader.load(data.buffer);
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

/**
 * 解析图片的 EXIF 日期
 * @param action 文件操作
 * @returns 文件操作
 */
export function resolveExifDate(action: FileAction): Observable<FileAction> {
    /**
     * 检查图片的 EXIF 日期
     * @param action 文件操作
     * @returns 文件操作
     */
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

    /**
     * 解析图片的 EXIF 日期
     * @param action 文件操作
     * @returns 文件操作
     */
    return from(promise).pipe(
        catchError(() => {
            action.isImage = false;
            return of(action);
        }),
    );
}
