import { describe, it, expect, beforeEach, vi } from "vitest";
import { toFullPath, ensureDir } from "../path-helper";
import { vol } from "memfs";
import type { FileAction } from "@common/types";
import { firstValueFrom } from "rxjs";
import path from "path";
import * as pathHelper from "../path-helper";

vi.mock("fs-extra", () => ({
    default: {
        ensureDir: vi.fn((dir, callback) => {
            // Immediately call the callback to avoid timeout
            if (callback) callback();
        }),
    },
    ensureDir: vi.fn((dir, callback) => {
        // Immediately call the callback to avoid timeout
        if (callback) callback();
    }),
}));

describe("path-helper", () => {
    beforeEach(() => {
        vol.reset();
    });

    describe("toFullPath", () => {
        it("should return full path", () => {
            expect(toFullPath("test", { root: "root" })).toBe(path.join("root", "test"));
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
            expect(result.targetDir).toBe(path.join("/test/target", "test.md"));
        });
    });
});

describe("normalizePath/mergePath platform coverage", () => {
    it("should normalize Windows path", () => {
        // Only run this test on Windows platform
        if (process.platform !== "win32") {
            console.log("Skipping Windows path test on non-Windows platform");
            return;
        }

        const winPath = "C:\\foo\\bar/abc";
        // On Windows, path.normalize should handle Windows paths correctly
        const result = pathHelper.normalizePath(winPath);
        const expected = path.normalize(winPath);
        expect(result).toBe(expected);
    });
    it("should normalize POSIX path", () => {
        const posixPath = "/foo/bar/abc";
        // On Windows, path.normalize will return Windows format, so we need to check differently
        if (process.platform === "win32") {
            expect(pathHelper.normalizePath(posixPath)).toBe("C:\\foo\\bar\\abc");
        } else {
            expect(pathHelper.normalizePath(posixPath)).toBe(path.normalize(posixPath));
        }
    });
    it("should merge Windows path", () => {
        // Only run this test on Windows platform
        if (process.platform !== "win32") {
            console.log("Skipping Windows path merge test on non-Windows platform");
            return;
        }

        const left = "C:\\foo\\bar";
        const right = "baz";
        // On Windows, path.join should handle Windows paths correctly
        expect(pathHelper.mergePath(left, right)).toBe(path.join(left, right));
    });
    it("should merge POSIX path", () => {
        const left = "/foo/bar";
        const right = "baz";
        expect(pathHelper.mergePath(left, right)).toBe(path.join(left, right));
    });
});
