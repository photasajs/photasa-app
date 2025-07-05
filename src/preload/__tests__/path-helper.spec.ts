import { describe, it, expect, beforeEach, vi } from "vitest";
import { toFullPath, ensureDir } from "../path-helper";
import { vol } from "memfs";
import type { FileAction } from "@common/scan-types";
import { firstValueFrom } from "rxjs";
import path from "path";
import * as pathHelper from "../path-helper";

vi.mock("fs");
vi.mock("fs/promises");

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

describe("normalizePath/mergePath platform coverage", () => {
    it("should normalize Windows path", () => {
        const winPath = "C:\\foo\\bar/abc";
        expect(pathHelper.normalizePath(winPath)).toBe(path.win32.normalize(winPath));
    });
    it("should normalize POSIX path", () => {
        const posixPath = "/foo/bar/abc";
        expect(pathHelper.normalizePath(posixPath)).toBe(path.posix.normalize(posixPath));
    });
    it("should merge Windows path", () => {
        const left = "C:\\foo\\bar";
        const right = "baz";
        expect(pathHelper.mergePath(left, right)).toBe(path.win32.join(left, right));
    });
    it("should merge POSIX path", () => {
        const left = "/foo/bar";
        const right = "baz";
        expect(pathHelper.mergePath(left, right)).toBe(path.posix.join(left, right));
    });
});
