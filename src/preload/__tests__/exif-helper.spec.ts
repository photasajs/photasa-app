import { firstValueFrom } from "rxjs";
import { checkExifDate, resolveExifDate } from "../exif-helper";
import path from "path";
import { Moment } from "moment";

const IMAGE_PATH = path.join(__dirname, "./photos/test.jpg");

jest.mock("moment", () => {
    return (): Moment => jest.requireActual("moment")("2020-01-01T00:00:00.000Z");
});

describe("exif-helper", () => {
    it("should return undefined if image don't have exif date", async () => {
        const date = await checkExifDate(IMAGE_PATH);
        expect(date).toBeUndefined();
    });

    it("should return exif date if image have exif date", async () => {
        const date = await firstValueFrom(
            resolveExifDate({
                file: IMAGE_PATH,
                name: "",
                isImage: false,
                targetDir: "",
                targetFileName: "",
                targetFullPath: "",
            }),
        );
        expect(date.created?.toString()).toBe(
            "Tue Dec 31 2019 16:00:00 GMT-0800 (Pacific Standard Time)",
        );
    });
});
