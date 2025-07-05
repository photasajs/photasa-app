import { describe, it, expect } from "vitest";
import path from "path";
import {
    isFileUnderFolder,
    toFileName,
    normalizePath,
    mergePath,
    toDirName,
    toExtName,
    relativePath,
    resolvePath,
    isAbsolutePath,
} from "../path-util";

describe("isFileUnderFolder", () => {
    it("should detect files under specified folder", () => {
        const file = "/path/to/folder/file.jpg";
        const folder = "/path/to/folder";
        const expected = path.resolve(path.dirname(file)) === path.resolve(folder);
        expect(isFileUnderFolder(file, folder)).toBe(expected);

        const file2 = "C:/book/sime.jpg";
        const folder2 = "C:/book";
        const expected2 = path.resolve(path.dirname(file2)) === path.resolve(folder2);
        expect(isFileUnderFolder(file2, folder2)).toBe(expected2);

        const file3 = "C:/path/to/other/file.jpg";
        const folder3 = "C:/path/to/folder";
        const expected3 = path.resolve(path.dirname(file3)) === path.resolve(folder3);
        expect(isFileUnderFolder(file3, folder3)).toBe(expected3);
    });
    it("should handle edge cases", () => {
        expect(isFileUnderFolder("", "")).toBe(false);
        const file = "/file.jpg";
        const folder = "/";
        const expected = path.resolve(path.dirname(file)) === path.resolve(folder);
        expect(isFileUnderFolder(file, folder)).toBe(expected);
    });
});

describe("toFileName", () => {
    it("should extract file name with extension", () => {
        expect(toFileName("/path/to/file.jpg")).toBe(path.basename("/path/to/file.jpg"));
        expect(toFileName("file.jpg")).toBe(path.basename("file.jpg"));
        expect(toFileName("/book/sime.jpg")).toBe(path.basename("/book/sime.jpg"));
        expect(toFileName("C:/path/to/file.jpg")).toBe(path.basename("C:/path/to/file.jpg"));
        expect(toFileName("C:/book/sime.jpg")).toBe(path.basename("C:/book/sime.jpg"));
    });
    it("should handle edge cases", () => {
        expect(toFileName("")).toBe("");
        expect(toFileName("/path/with.dot/file.name.jpg")).toBe(
            path.basename("/path/with.dot/file.name.jpg"),
        );
        expect(toFileName("C:/path.with.dot/file.name.jpg")).toBe(
            path.basename("C:/path.with.dot/file.name.jpg"),
        );
    });
});

describe("normalizePath", () => {
    it("should normalize paths (platform native)", () => {
        expect(normalizePath("/foo/bar/../baz")).toBe(path.normalize("/foo/bar/../baz"));
        expect(normalizePath("/foo//bar//baz")).toBe(path.normalize("/foo//bar//baz"));
        expect(normalizePath("C:\\foo\\bar\\..\\baz")).toBe(
            path.normalize("C:\\foo\\bar\\..\\baz"),
        );
        expect(normalizePath("C:\\foo\\\\bar\\\\baz")).toBe(
            path.normalize("C:\\foo\\\\bar\\\\baz"),
        );
    });
    it("should handle edge cases", () => {
        expect(normalizePath("")).toBe(path.normalize(""));
        expect(normalizePath(".")).toBe(path.normalize("."));
        expect(normalizePath("/../")).toBe(path.normalize("/../"));
    });
});

describe("mergePath", () => {
    it("should join two paths (platform native)", () => {
        expect(mergePath("/foo", "bar")).toBe(path.join("/foo", "bar"));
        expect(mergePath("/foo/", "bar")).toBe(path.join("/foo/", "bar"));
        expect(mergePath("C:/foo", "bar")).toBe(path.join("C:/foo", "bar"));
        expect(mergePath("C:/foo/", "bar")).toBe(path.join("C:/foo/", "bar"));
        expect(mergePath("/foo/bar", "")).toBe(path.join("/foo/bar", ""));
        expect(mergePath("", "bar")).toBe(path.join("", "bar"));
    });
    it("should handle edge cases", () => {
        expect(mergePath("", "")).toBe(path.join("", ""));
        expect(mergePath("/", "/")).toBe(path.join("/", "/"));
        expect(mergePath("C:/", "/")).toBe(path.join("C:/", "/"));
    });
});

describe("toDirName", () => {
    it("should extract directory name", () => {
        expect(toDirName("/foo/bar/file.txt")).toBe(path.dirname("/foo/bar/file.txt"));
        expect(toDirName("C:/foo/bar/file.txt")).toBe(path.dirname("C:/foo/bar/file.txt"));
        expect(toDirName("file.txt")).toBe(path.dirname("file.txt"));
        expect(toDirName("")).toBe(path.dirname(""));
    });
});

describe("toExtName", () => {
    it("should extract extension name", () => {
        expect(toExtName("/foo/bar/file.txt")).toBe(path.extname("/foo/bar/file.txt"));
        expect(toExtName("C:/foo/bar/file.jpg")).toBe(path.extname("C:/foo/bar/file.jpg"));
        expect(toExtName("file")).toBe(path.extname("file"));
        expect(toExtName("")).toBe(path.extname(""));
    });
});

describe("relativePath", () => {
    it("should compute relative path", () => {
        expect(relativePath("/foo/bar", "/foo/bar/file.txt")).toBe(
            path.relative("/foo/bar", "/foo/bar/file.txt"),
        );
        expect(relativePath("C:/foo", "C:/foo/bar/file.txt")).toBe(
            path.relative("C:/foo", "C:/foo/bar/file.txt"),
        );
        expect(relativePath("/", "/file.txt")).toBe(path.relative("/", "/file.txt"));
        expect(relativePath("", "file.txt")).toBe(path.relative("", "file.txt"));
    });
});

describe("resolvePath", () => {
    it("should resolve absolute path", () => {
        expect(resolvePath("/foo", "bar", "file.txt")).toBe(
            path.resolve("/foo", "bar", "file.txt"),
        );
        expect(resolvePath("C:/foo", "bar", "file.txt")).toBe(
            path.resolve("C:/foo", "bar", "file.txt"),
        );
        expect(resolvePath("file.txt")).toBe(path.resolve("file.txt"));
        expect(resolvePath("")).toBe(path.resolve(""));
    });
});

describe("isAbsolutePath", () => {
    it("should check if path is absolute", () => {
        expect(isAbsolutePath("/foo/bar")).toBe(path.isAbsolute("/foo/bar"));
        expect(isAbsolutePath("C:/foo/bar")).toBe(path.isAbsolute("C:/foo/bar"));
        expect(isAbsolutePath("file.txt")).toBe(path.isAbsolute("file.txt"));
        expect(isAbsolutePath("")).toBe(path.isAbsolute(""));
    });
});
