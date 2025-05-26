import { firstValueFrom } from "rxjs";
import { checkExifDate, resolveExifDate } from "../exif-helper";
import path from "path";
import fs from "fs-extra";

const IMAGE_PATH = path.join(__dirname, "./assets/no_exif_info.jpg");
const EXIF_IMAGE_PATH = path.join(__dirname, "./assets/exif.jpg");
const CTIME_IMAGE_PATH = path.join(__dirname, "./assets/birthtime.jpg");

describe("exif-helper", () => {
    it("should return undefined if image don't have exif date", async () => {
        const date = await checkExifDate(IMAGE_PATH);
        expect(date).toBeUndefined();
    });

    it("should return exif date if image have exif date", async () => {
        const stat = fs.statSync(EXIF_IMAGE_PATH);
        const date = await firstValueFrom(
            resolveExifDate({
                file: EXIF_IMAGE_PATH,
                created: stat.birthtime,
                name: "",
                isImage: false,
                targetDir: "",
                targetFileName: "",
                targetFullPath: "",
                isVideo: false,
            }),
        );
        expect(date.created?.toString()).toBe(
            "Thu Feb 09 2023 06:19:39 GMT-0800 (Pacific Standard Time)",
        );
    });

    it("should return exif date if image have exif date", async () => {
        const stat = fs.statSync(CTIME_IMAGE_PATH);
        const action = {
            file: CTIME_IMAGE_PATH,
            name: "",
            isImage: false,
            created: stat.birthtime,
            targetDir: "",
            targetFileName: "",
            targetFullPath: "",
            isVideo: false,
            targetName: "",
        };
        const date = await firstValueFrom(resolveExifDate(action));
        expect(date.created?.toString()).toBe(
            "Thu Jan 19 2023 13:50:41 GMT-0800 (Pacific Standard Time)",
        );
        expect(action.targetName).toBe("2023/20230119");
    });
});
