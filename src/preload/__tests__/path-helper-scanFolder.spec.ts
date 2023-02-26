import { scanFolder } from "../path-helper";
import path from "path";

const IMAGE_PATH = path.join(__dirname, "./photos/");
const TEST_PATH = path.join(__dirname, "./scan/");

describe("path-helper", () => {
    describe("scanFolder", () => {
        it("should scan folder", (done) => {
            expect.assertions(5);
            let count = 0;
            scanFolder(IMAGE_PATH, TEST_PATH).subscribe({
                next(action) {
                    expect(action.file).toBe(path.join(__dirname, "/photos/test.jpg"));
                    expect(action.name).toBe("test.jpg");
                    expect(action.targetName).toBe("2018/20180920");
                    expect(action.isImage).toBeTruthy();

                    count++;
                },
                error(err) {
                    throw err;
                },
                complete() {
                    expect(count).toBe(1);
                    done();
                },
            });
        });
    });
});
