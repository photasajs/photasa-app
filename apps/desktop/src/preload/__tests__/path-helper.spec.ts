import { describe, it, expect, beforeEach, vi } from "vitest";
import { toFullPath, ensureDir } from "../path-helper";
import { vol } from "memfs";
import type { FileAction } from "@photasa/common";
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
            expect.assertions(0); // Skip test on non-Windows platform
            return;
        }

        const winPath = "C:\\foo\\bar/abc";
        // On Windows, path.resolve should handle Windows paths correctly
        const result = pathHelper.normalizePath(winPath);
        const expected = path.resolve(winPath);
        expect(result).toBe(expected);
    });
    it("should normalize POSIX path", () => {
        const posixPath = "/foo/bar/abc";
        // normalizePath uses path.resolve, which returns absolute path based on current platform
        const result = pathHelper.normalizePath(posixPath);
        const expected = path.resolve(posixPath);
        expect(result).toBe(expected);
    });
    it("should merge Windows path", () => {
        // Only run this test on Windows platform
        if (process.platform !== "win32") {
            expect.assertions(0); // Skip test on non-Windows platform
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
