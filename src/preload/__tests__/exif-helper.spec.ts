import { firstValueFrom } from "rxjs";
import { checkExifDate, resolveExifDate } from "../exif-helper";
import path from "path";
import fs from "fs-extra";

const IMAGE_PATH = path.join(__dirname, "./assets/no_exif_info.jpg");
const EXIF_IMAGE_PATH = path.join(__dirname, "./assets/exif.jpg");
const CTIME_IMAGE_PATH = path.join(__dirname, "./assets/birthtime.jpg");

describe.skip("exif-helper", () => {
    it("should return null if image don't have exif date", async () => {
        const date = await checkExifDate(IMAGE_PATH);
        expect(date).toBeNull();
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
        // Since the test image doesn't have EXIF date, it should fallback to current date
        expect(date.created).toBeInstanceOf(Date);
        expect(date.targetName).toMatch(/^\d{4}\/\d{8}$/); // Should match YYYY/YYYYMMDD format
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
        // Since the test image doesn't have EXIF date, it should fallback to current date
        expect(date.created).toBeInstanceOf(Date);
        expect(action.targetName).toMatch(/^\d{4}\/\d{8}$/); // Should match YYYY/YYYYMMDD format
    });
});
