import fs from "fs-extra";
import path from "path";
import { firstValueFrom } from "rxjs";
import { copyFile } from "../file-helper";

const IMAGE_PATH = path.join(__dirname, "./assets/exif.jpg");
const TEST_PATH = path.join(__dirname, "./copy/");

describe("copyFile", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_PATH)) {
            fs.removeSync(TEST_PATH);
        }
    });

    afterEach(() => {
        if (fs.existsSync(TEST_PATH)) {
            fs.removeSync(TEST_PATH);
        }
    });

    it("should copy file", async () => {
        await fs.ensureDir(TEST_PATH);

        await firstValueFrom(
            copyFile({
                file: IMAGE_PATH,
                name: path.basename(IMAGE_PATH),
                targetDir: TEST_PATH,
                created: new Date("2018-09-20T19:25:22.000Z"),
                isImage: false,
                targetFileName: "",
                targetFullPath: "",
                isVideo: false,
            }),
        );

        expect(fs.existsSync(path.join(TEST_PATH, "exif.jpg"))).toBeTruthy();

        await firstValueFrom(
            copyFile({
                file: IMAGE_PATH,
                name: path.basename(IMAGE_PATH),
                targetDir: TEST_PATH,
                created: new Date("2018-09-20T19:25:22.000Z"),
                isImage: true,
                targetFileName: "",
                targetFullPath: "",
                isVideo: false,
            }),
        );
        expect(fs.existsSync(path.join(TEST_PATH, "exif_1.jpg"))).toBeTruthy();
    });
});
