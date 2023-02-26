import { toFullPath, ensureDir } from "../path-helper";
import { vol } from "memfs";
import { FileAction } from "../file-action";
import { firstValueFrom } from "rxjs";

jest.mock("fs");
jest.mock("fs/promises");

describe("path-helper", () => {
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
                targetName: "test.md",
                name: "",
                targetDir: "",
            };

            await firstValueFrom<FileAction>(ensureDir(action));

            expect(vol.existsSync(action.targetDir)).toBe(true);
        });
    });
});
