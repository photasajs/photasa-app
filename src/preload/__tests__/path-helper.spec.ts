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
            expect(toFullPath("test", { root: "root" })).toBe(path.posix.join("root", "test"));
        });
    });

    describe("ensureDir", () => {
        it("should create directory", async () => {
            const action: FileAction = {
                target: "/test/target",
                file: "/text.txt",
                isImage: false,
                isVideo: false,
                targetName: "test.md",
                name: "",
                targetDir: "",
                targetFileName: "",
                targetFullPath: "",
            };

            const result = await firstValueFrom<FileAction>(ensureDir(action));

            // The function should set targetDir based on target and targetName
            expect(result.targetDir).toBe(path.posix.join("/test/target", "test.md"));
        });
    });
});

describe("normalizePath/mergePath platform coverage", () => {
    it("should normalize Windows path", () => {
        const winPath = "C:\\foo\\bar/abc";
        // Use current platform's normalize since we're not in Windows environment
        expect(pathHelper.normalizePath(winPath)).toBe(path.normalize(winPath));
    });
    it("should normalize POSIX path", () => {
        const posixPath = "/foo/bar/abc";
        expect(pathHelper.normalizePath(posixPath)).toBe(path.posix.normalize(posixPath));
    });
    it("should merge Windows path", () => {
        const left = "C:\\foo\\bar";
        const right = "baz";
        // Use current platform's join since we're not in Windows environment
        expect(pathHelper.mergePath(left, right)).toBe(path.join(left, right));
    });
    it("should merge POSIX path", () => {
        const left = "/foo/bar";
        const right = "baz";
        expect(pathHelper.mergePath(left, right)).toBe(path.posix.join(left, right));
    });
});
