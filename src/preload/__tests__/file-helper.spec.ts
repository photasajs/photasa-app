import { fileExistSync } from "../file-helper";
import { vol } from "memfs";
import fs from "fs-extra";

jest.mock("fs");
jest.mock("fs/promises");

describe("file-helper", () => {
    beforeEach(() => {
        vol.reset();
    });
    describe("fileExistSync", () => {
        it("should return false if file didn't exist", () => {
            const result = fileExistSync("test");
            expect(result).toBe(false);
        });

        it("should return true if file exists", async () => {
            const fileName = "/test.txt";

            await fs.writeFile(fileName, "test");

            const result = fileExistSync(fileName, { root: "/" });
            expect(result).toBe(true);
        });
        it("should return true if file exists when option is empty", async () => {
            const fileName = "/test.txt";

            await fs.createFile(fileName);
            await fs.writeFile(fileName, "test");

            const result = fileExistSync(fileName);
            expect(result).toBe(true);
        });
    });
});
