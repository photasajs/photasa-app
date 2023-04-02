import { toFullPath, ensureDir } from "../path-helper";
import { vol } from "memfs";
import type { FileAction } from "../types";
import { firstValueFrom } from "rxjs";

jest.mock("fs");
jest.mock("fs/promises");

describe("path-helper", () => {
    beforeEach(() => {
        vol.reset();
    });

    describe("toFullPath", () => {
        it("should return full path", () => {
            expect(toFullPath("test", { root: "root" })).toBe("root/test");
        });
    });

    describe("ensureDir", () => {
        it("should create directory", async () => {
            const action: FileAction = {
                target: "/test/test/test",
                file: "/text.txt",
                isImage: false,
                isVideo: false,
                targetName: "test.md",
                name: "",
                targetDir: "",
                targetFileName: "",
                targetFullPath: "",
            };

            await firstValueFrom<FileAction>(ensureDir(action));

            expect(vol.existsSync(action.targetDir)).toBe(true);
        });
    });
});
