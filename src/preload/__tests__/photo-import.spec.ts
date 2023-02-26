import { importPhotos } from "../photo-import";
import path from "path";
import fs from "fs-extra";

const IMAGE_PATH = path.join(__dirname, "./photos/");
const TEST_PATH = path.join(__dirname, "./tests/");

describe("photo-import", () => {
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

    it("should import photos", (done) => {
        expect.assertions(2);
        importPhotos([IMAGE_PATH], TEST_PATH).subscribe({
            next(result) {
                expect(result).toStrictEqual({
                    created: new Date("2018-09-20T19:25:22.000Z"),
                    file: path.join(__dirname, "/photos/test.jpg"),
                    isImage: true,
                    name: "test.jpg",
                    target: path.join(__dirname, "/tests/"),
                    targetDir: path.join(__dirname, "/tests/2018/20180920"),
                    targetFileName: "test.jpg",
                    targetFullPath: path.join(__dirname, "/tests/2018/20180920/test.jpg"),
                    targetName: "2018/20180920",
                });
            },
            error(err) {
                throw err;
            },
            complete() {
                expect(fs.existsSync(path.join(TEST_PATH, "2018/20180920/test.jpg"))).toBeTruthy();
                done();
            },
        });
    });
});
