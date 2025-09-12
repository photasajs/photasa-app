import { describe, it, expect, vi } from "vitest";
import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import {
    isFileUnderFolder,
    toFileName,
    mergePath,
    toDirName,
    toExtName,
    relativePath,
    resolvePath,
    isAbsolutePath,
    shortenThumbnailName,
    toThumbnailName,
    toPreviewPath,
    toRelativeThumbnailPath,
    buildThumbnailPath,
    isHiddenFile,
    isDirectory,
    isFile,
    normalizePath,
    pathToFileProtocol,
    joinFileProtocolPath,
    getAppPath,
    removeFileProtocol,
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
        expect(normalizePath("/foo/bar/../baz")).toBe(path.resolve("/foo/bar/../baz"));
        expect(normalizePath("/foo//bar//baz")).toBe(path.resolve("/foo//bar//baz"));
        expect(normalizePath("C:\\foo\\bar\\..\\baz")).toBe(path.resolve("C:\\foo\\bar\\..\\baz"));
        expect(normalizePath("C:\\foo\\\\bar\\\\baz")).toBe(path.resolve("C:\\foo\\\\bar\\\\baz"));
    });
    it("should handle edge cases", () => {
        expect(normalizePath("")).toBe("");
        expect(normalizePath(".")).toBe(path.resolve("."));
        expect(normalizePath("/../")).toBe(path.resolve("/../"));
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

describe("shortenThumbnailName", () => {
    it("should shorten thumbnail path to relative path", () => {
        const result = shortenThumbnailName("/path/to/photos/.photasaoriginals/thumb.png");
        expect(result).toBe(path.join(".photasaoriginals", "thumb.png"));
    });

    it("should handle various file paths", () => {
        expect(shortenThumbnailName("/Users/Albert/Photos/.photasaoriginals/image.png")).toBe(
            path.join(".photasaoriginals", "image.png"),
        );
        expect(shortenThumbnailName("C:/Photos/.photasaoriginals/photo.png")).toBe(
            path.join(".photasaoriginals", "photo.png"),
        );
    });
});

describe("toThumbnailName", () => {
    it("should convert filename to thumbnail name", () => {
        const result = toThumbnailName("photo.jpg");
        expect(result).toBe("thumbnail-photo.jpg.png");
    });

    it("should handle file paths", () => {
        const result = toThumbnailName("/path/to/photo.jpg");
        expect(result).toBe("thumbnail-photo.jpg.png");
    });

    it("should handle empty filename", () => {
        const result = toThumbnailName("");
        expect(result).toBe("thumbnail-.png");
    });
});

describe("toPreviewPath", () => {
    it("should build preview image path", () => {
        const result = toPreviewPath("/Users/Albert/Photos/photo.jpg");
        expect(result).toBe(path.join("/Users/Albert/Photos", ".photasaoriginals", "photo.jpeg"));
    });

    it("should handle Windows paths", () => {
        const result = toPreviewPath("C:/Photos/image.heic");
        expect(result).toBe(path.join("C:", "Photos", ".photasaoriginals", "image.jpeg"));
    });

    it("should handle files without extension", () => {
        const result = toPreviewPath("/path/to/photo");
        expect(result).toBe(path.join("/path/to", ".photasaoriginals", "photo.jpeg"));
    });
});

describe("toRelativeThumbnailPath", () => {
    it("should build relative thumbnail path", () => {
        const result = toRelativeThumbnailPath("/Users/Albert/Photos/photo.jpg");
        expect(result).toBe(path.join(".photasaoriginals", "thumbnail-photo.jpg.png"));
    });

    it("should handle various file paths", () => {
        expect(toRelativeThumbnailPath("image.png")).toBe(
            path.join(".photasaoriginals", "thumbnail-image.png.png"),
        );
    });
});

describe("buildThumbnailPath", () => {
    it("should build absolute thumbnail path", () => {
        const result = buildThumbnailPath("/Users/Albert/Photos/photo.jpg");
        const expected = path.join(
            path.normalize(path.join("/Users/Albert/Photos", ".photasaoriginals")),
            "thumbnail-photo.jpg.png",
        );
        expect(result).toBe(expected);
    });

    it("should handle Windows paths", () => {
        const result = buildThumbnailPath("C:/Photos/image.png");
        const expected = path.join(
            path.normalize(path.join("C:/Photos", ".photasaoriginals")),
            "thumbnail-image.png.png",
        );
        expect(result).toBe(expected);
    });
});

describe("isHiddenFile", () => {
    it("should detect hidden files", () => {
        expect(isHiddenFile(".hidden")).toBe(true);
        expect(isHiddenFile(".DS_Store")).toBe(true);
        expect(isHiddenFile("/path/to/.hidden_file")).toBe(true);
        expect(isHiddenFile("C:/Users/.bashrc")).toBe(true);
    });

    it("should not flag regular files as hidden", () => {
        expect(isHiddenFile("regular.txt")).toBe(false);
        expect(isHiddenFile("/path/to/file.jpg")).toBe(false);
        expect(isHiddenFile("C:/Users/file.png")).toBe(false);
        expect(isHiddenFile("")).toBe(false);
    });

    it("should handle files with dots in the middle", () => {
        expect(isHiddenFile("file.name.txt")).toBe(false);
        expect(isHiddenFile("/path/file.name.jpg")).toBe(false);
    });
});

describe("isDirectory", () => {
    it("should detect directories", async () => {
        // Mock fs.promises.stat to return directory
        const mockStat = vi.spyOn(fs.promises, "stat").mockResolvedValue({
            isDirectory: () => true,
            isFile: () => false,
        } as any);

        const result = await isDirectory("/some/directory");
        expect(result).toBe(true);
        expect(mockStat).toHaveBeenCalledWith("/some/directory");

        mockStat.mockRestore();
    });

    it("should not flag files as directories", async () => {
        // Mock fs.promises.stat to return file
        const mockStat = vi.spyOn(fs.promises, "stat").mockResolvedValue({
            isDirectory: () => false,
            isFile: () => true,
        } as any);

        const result = await isDirectory("/some/file.txt");
        expect(result).toBe(false);
        expect(mockStat).toHaveBeenCalledWith("/some/file.txt");

        mockStat.mockRestore();
    });

    it("should return false for non-existent paths", async () => {
        // Mock fs.promises.stat to throw error
        const mockStat = vi.spyOn(fs.promises, "stat").mockRejectedValue(new Error("ENOENT"));

        const result = await isDirectory("/non/existent/path");
        expect(result).toBe(false);
        expect(mockStat).toHaveBeenCalledWith("/non/existent/path");

        mockStat.mockRestore();
    });
});

describe("isFile", () => {
    it("should detect files", async () => {
        // Mock fs.promises.stat to return file
        const mockStat = vi.spyOn(fs.promises, "stat").mockResolvedValue({
            isDirectory: () => false,
            isFile: () => true,
        } as any);

        const result = await isFile("/some/file.txt");
        expect(result).toBe(true);
        expect(mockStat).toHaveBeenCalledWith("/some/file.txt");

        mockStat.mockRestore();
    });

    it("should not flag directories as files", async () => {
        // Mock fs.promises.stat to return directory
        const mockStat = vi.spyOn(fs.promises, "stat").mockResolvedValue({
            isDirectory: () => true,
            isFile: () => false,
        } as any);

        const result = await isFile("/some/directory");
        expect(result).toBe(false);
        expect(mockStat).toHaveBeenCalledWith("/some/directory");

        mockStat.mockRestore();
    });

    it("should return false for non-existent paths", async () => {
        // Mock fs.promises.stat to throw error
        const mockStat = vi.spyOn(fs.promises, "stat").mockRejectedValue(new Error("ENOENT"));

        const result = await isFile("/non/existent/file");
        expect(result).toBe(false);
        expect(mockStat).toHaveBeenCalledWith("/non/existent/file");

        mockStat.mockRestore();
    });
});

describe("normalizePath", () => {
    it("should handle file:// URLs correctly", () => {
        // 测试 file:// URL 转换
        const fileUrl = pathToFileURL("/Users/Albert/Pictures/photo.jpg").toString();
        const result = normalizePath(fileUrl);
        expect(path.isAbsolute(result)).toBe(true);
        expect(result).toBe(path.resolve("/Users/Albert/Pictures/photo.jpg"));
    });

    it("should handle Windows file:// URLs", () => {
        // Windows file:// URL 格式测试
        const windowsFileUrl = "file:///C:/Users/Albert/Pictures/photo.jpg";
        const result = normalizePath(windowsFileUrl);
        expect(path.isAbsolute(result)).toBe(true);

        if (process.platform === "win32") {
            // 在 Windows 上应该得到正确的路径格式
            expect(result).toBe(path.resolve("C:/Users/Albert/Pictures/photo.jpg"));
        } else {
            // 在非Windows系统上，Node.js会将其解析为Unix路径
            expect(result.includes("C:")).toBe(true);
        }
    });

    it("should handle normal file system paths", () => {
        // Unix 路径
        const unixPath = "/Users/Albert/Pictures/photo.jpg";
        expect(normalizePath(unixPath)).toBe(path.resolve(unixPath));

        // Windows 路径格式
        const windowsPath = "C:\\Users\\Albert\\Pictures\\photo.jpg";
        expect(normalizePath(windowsPath)).toBe(path.resolve(windowsPath));

        // Windows 正斜杠格式
        const windowsSlashPath = "C:/Users/Albert/Pictures/photo.jpg";
        expect(normalizePath(windowsSlashPath)).toBe(path.resolve(windowsSlashPath));
    });

    it("should handle relative paths", () => {
        const relativePath1 = "./Pictures/photo.jpg";
        expect(path.isAbsolute(normalizePath(relativePath1))).toBe(true);
        expect(normalizePath(relativePath1)).toBe(path.resolve(relativePath1));

        const relativePath2 = "../Documents/photo.jpg";
        expect(path.isAbsolute(normalizePath(relativePath2))).toBe(true);
        expect(normalizePath(relativePath2)).toBe(path.resolve(relativePath2));
    });

    it("should fix Mac external volume paths missing leading slash", () => {
        // Mac 外部卷路径缺少前导斜杠的情况
        const brokenMacPath = "Volumes/ExternalDrive/Photos/photo.jpg";
        const result = normalizePath(brokenMacPath);
        expect(path.isAbsolute(result)).toBe(true);
        // 应该被解析为绝对路径
        expect(result).toBe(path.resolve(brokenMacPath));
    });

    it("should handle empty input", () => {
        expect(normalizePath("")).toBe("");
        expect(normalizePath(null as any)).toBe("");
        expect(normalizePath(undefined as any)).toBe("");
    });

    it("should handle URL objects", () => {
        const urlObj = new URL("file:///Users/Albert/Pictures/photo.jpg");
        const result = normalizePath(urlObj);
        expect(path.isAbsolute(result)).toBe(true);
        expect(result).toBe(path.resolve("/Users/Albert/Pictures/photo.jpg"));
    });

    it("should handle malformed file:// URLs gracefully", () => {
        // 格式错误的 file:// URL 应该回退到路径处理
        const malformedUrl = "file://invalid/path";
        const result = normalizePath(malformedUrl);
        // 应该仍然返回一个路径，即使可能不是预期的
        expect(result).toBeTruthy();
    });

    it("should handle the problematic paths from original issue", () => {
        // 原始问题：Mac外部卷路径缺少前导斜杠
        const problematicMacPath = "Volumes/SUCAI/Backup/2021/20210101/20210102_030833820_iOS.heic";
        const result = normalizePath(problematicMacPath);
        expect(path.isAbsolute(result)).toBe(true);

        // 原始问题：Windows路径带错误前导斜杠
        const problematicWinPath = "/C:/Users/Albert/Pictures/photo.jpg";
        const result2 = normalizePath(problematicWinPath);
        expect(path.isAbsolute(result2)).toBe(true);
    });
});

describe("pathToFileProtocol", () => {
    it("should convert file path to file:// URL", () => {
        const filePath = "/Users/Albert/Pictures/photo.jpg";
        const result = pathToFileProtocol(filePath);
        expect(result.startsWith("file://")).toBe(true);

        // 验证可以往返转换
        const backToPath = fileURLToPath(result);
        expect(backToPath).toBe(path.resolve(filePath));
    });

    it("should handle Windows paths", () => {
        const windowsPath = "C:\\Users\\Albert\\Pictures\\photo.jpg";
        const result = pathToFileProtocol(windowsPath);
        expect(result.startsWith("file://")).toBe(true);

        if (process.platform === "win32") {
            // Windows file:// URL 格式应该是 file:///C:/...
            expect(result).toMatch(/^file:\/\/\/[A-Z]:\//);
        }
    });

    it("should normalize paths before conversion", () => {
        // 相对路径应该被转换为绝对路径再转为 URL
        const relativePath = "./Pictures/photo.jpg";
        const result = pathToFileProtocol(relativePath);
        expect(result.startsWith("file://")).toBe(true);

        const backToPath = fileURLToPath(result);
        expect(path.isAbsolute(backToPath)).toBe(true);
    });

    it("should handle paths that are already file:// URLs", () => {
        const fileUrl = pathToFileURL("/Users/Albert/Pictures/photo.jpg").toString();
        const result = pathToFileProtocol(fileUrl);
        expect(result.startsWith("file://")).toBe(true);

        // 应该仍然是有效的 file:// URL
        const backToPath = fileURLToPath(result);
        expect(path.isAbsolute(backToPath)).toBe(true);
    });

    it("should fix problematic paths before conversion", () => {
        // Mac 外部卷缺少前导斜杠
        const brokenMacPath = "Volumes/ExternalDrive/Photos/photo.jpg";
        const result = pathToFileProtocol(brokenMacPath);
        expect(result.startsWith("file://")).toBe(true);

        // Windows 路径带错误前导斜杠
        const brokenWindowsPath = "/C:/Users/Albert/Pictures/photo.jpg";
        const result2 = pathToFileProtocol(brokenWindowsPath);
        expect(result2.startsWith("file://")).toBe(true);
    });
});

describe("joinFileProtocolPath", () => {
    it("should join paths with file:// URL base", () => {
        const fileUrl = pathToFileURL("/Users/Albert").toString();
        const result = joinFileProtocolPath(fileUrl, "Pictures", "photo.jpg");
        expect(path.isAbsolute(result)).toBe(true);
        expect(result).toBe(path.resolve("/Users/Albert", "Pictures", "photo.jpg"));
    });

    it("should join paths with normal base path", () => {
        const result = joinFileProtocolPath("/Volumes/Drive", ".photasaoriginals", "thumb.png");
        expect(path.isAbsolute(result)).toBe(true);
        expect(result).toBe(path.resolve("/Volumes/Drive", ".photasaoriginals", "thumb.png"));
    });

    it("should handle Windows paths", () => {
        const result = joinFileProtocolPath("C:\\Users\\Albert", "Documents", "file.txt");
        expect(path.isAbsolute(result)).toBe(true);
        expect(result).toBe(path.resolve("C:\\Users\\Albert", "Documents", "file.txt"));
    });

    it("should handle empty segments array", () => {
        expect(joinFileProtocolPath()).toBe("");
    });

    it("should handle single segment", () => {
        const singlePath = "/Users/Albert/Pictures";
        expect(joinFileProtocolPath(singlePath)).toBe(path.resolve(singlePath));
    });

    it("should normalize problematic base paths", () => {
        // Mac 外部卷缺少前导斜杠
        const result1 = joinFileProtocolPath("Volumes/Drive", "Photos", "image.jpg");
        expect(path.isAbsolute(result1)).toBe(true);

        // Windows 路径带错误前导斜杠
        const result2 = joinFileProtocolPath("/C:/Users", "Albert", "file.txt");
        expect(path.isAbsolute(result2)).toBe(true);
    });

    it("should handle file:// URL in segments", () => {
        const fileUrl = "file:///Users/Albert/Photos";
        const result = joinFileProtocolPath(fileUrl, ".photasaoriginals", "thumb.png");
        expect(path.isAbsolute(result)).toBe(true);
        expect(result).toBe(path.resolve("/Users/Albert/Photos", ".photasaoriginals", "thumb.png"));
    });
});

describe("getAppPath", () => {
    it("should return app path when electronApp is provided", () => {
        const mockElectronApp = {
            getPath: vi.fn().mockReturnValue("/Applications/MyApp.app/Contents/MacOS/MyApp"),
        };

        const result = getAppPath(mockElectronApp);
        expect(result).toBe(path.dirname("/Applications/MyApp.app/Contents/MacOS/MyApp"));
        expect(mockElectronApp.getPath).toHaveBeenCalledWith("exe");
    });

    it("should return process.env.APP_PATH when electronApp is not provided but APP_PATH is set", () => {
        const originalAppPath = process.env.APP_PATH;
        process.env.APP_PATH = "/custom/app/path";

        const result = getAppPath();
        expect(result).toBe("/custom/app/path");

        // 恢复原始环境变量
        if (originalAppPath !== undefined) {
            process.env.APP_PATH = originalAppPath;
        } else {
            delete process.env.APP_PATH;
        }
    });

    it("should return process.cwd() as fallback", () => {
        const originalAppPath = process.env.APP_PATH;
        delete process.env.APP_PATH;

        const result = getAppPath();
        expect(result).toBe(process.cwd());

        // 恢复原始环境变量
        if (originalAppPath !== undefined) {
            process.env.APP_PATH = originalAppPath;
        }
    });

    it("should handle electronApp.getPath throwing error", () => {
        const mockElectronApp = {
            getPath: vi.fn().mockImplementation(() => {
                throw new Error("getPath failed");
            }),
        };

        const originalAppPath = process.env.APP_PATH;
        delete process.env.APP_PATH;

        const result = getAppPath(mockElectronApp);
        expect(result).toBe(process.cwd());
        expect(mockElectronApp.getPath).toHaveBeenCalledWith("exe");

        // 恢复原始环境变量
        if (originalAppPath !== undefined) {
            process.env.APP_PATH = originalAppPath;
        }
    });

    it("should handle undefined electronApp gracefully", () => {
        const originalAppPath = process.env.APP_PATH;
        delete process.env.APP_PATH;

        const result = getAppPath(undefined);
        expect(result).toBe(process.cwd());

        // 恢复原始环境变量
        if (originalAppPath !== undefined) {
            process.env.APP_PATH = originalAppPath;
        }
    });

    it("should handle electronApp without getPath method", () => {
        const mockElectronApp = {} as any;

        const originalAppPath = process.env.APP_PATH;
        delete process.env.APP_PATH;

        const result = getAppPath(mockElectronApp);
        expect(result).toBe(process.cwd());

        // 恢复原始环境变量
        if (originalAppPath !== undefined) {
            process.env.APP_PATH = originalAppPath;
        }
    });

    it("should prioritize electronApp over environment variables", () => {
        const mockElectronApp = {
            getPath: vi.fn().mockReturnValue("/app/executable/path"),
        };

        const originalAppPath = process.env.APP_PATH;
        process.env.APP_PATH = "/env/app/path";

        const result = getAppPath(mockElectronApp);
        expect(result).toBe(path.dirname("/app/executable/path"));
        expect(mockElectronApp.getPath).toHaveBeenCalledWith("exe");

        // 恢复原始环境变量
        if (originalAppPath !== undefined) {
            process.env.APP_PATH = originalAppPath;
        } else {
            delete process.env.APP_PATH;
        }
    });
});

describe("removeFileProtocol", () => {
    it("should remove file protocol for POSIX path", () => {
        const fileUrl = "file:///Users/Albert/Pictures/photo.jpg";
        const result = removeFileProtocol(fileUrl);
        expect(result).toBe("/Users/Albert/Pictures/photo.jpg");
    });

    it("should remove file protocol for Windows path", () => {
        const fileUrl = "file:///C:/Users/Albert/Pictures/photo.jpg";
        const result = removeFileProtocol(fileUrl);
        // 在非 Windows 系统上，fileURLToPath 会保留前导斜杠
        if (process.platform === "win32") {
            expect(result).toBe("C:/Users/Albert/Pictures/photo.jpg");
        } else {
            expect(result).toBe("/C:/Users/Albert/Pictures/photo.jpg");
        }
    });

    it("should handle Mac external volume", () => {
        const fileUrl = "file:///Volumes/ExternalDrive/Photos/photo.jpg";
        const result = removeFileProtocol(fileUrl);
        expect(result).toBe("/Volumes/ExternalDrive/Photos/photo.jpg");
    });

    it("should handle URL encoded paths", () => {
        const fileUrl = "file:///Users/Albert/Pictures/photo%20with%20spaces.jpg";
        const result = removeFileProtocol(fileUrl);
        expect(result).toBe("/Users/Albert/Pictures/photo with spaces.jpg");
    });

    it("should return unchanged if no protocol", () => {
        const normalPath = "/Users/Albert/Pictures/photo.jpg";
        const result = removeFileProtocol(normalPath);
        expect(result).toBe(normalPath);
    });

    it("should handle empty string", () => {
        const result = removeFileProtocol("");
        expect(result).toBe("");
    });

    it("should handle null/undefined", () => {
        expect(removeFileProtocol(null as any)).toBe("");
        expect(removeFileProtocol(undefined as any)).toBe("");
    });

    it("should handle malformed file URLs gracefully", () => {
        const malformedUrl = "file://invalid/path";
        const result = removeFileProtocol(malformedUrl);
        // 应该回退到手动处理
        expect(result).toBe("invalid/path");
    });

    it("should handle Windows paths with backslashes", () => {
        const fileUrl = "file:///C:/Users/Albert/Pictures/photo.jpg";
        const result = removeFileProtocol(fileUrl);
        // 在非 Windows 系统上，fileURLToPath 会保留前导斜杠
        if (process.platform === "win32") {
            expect(result).toBe("C:/Users/Albert/Pictures/photo.jpg");
        } else {
            expect(result).toBe("/C:/Users/Albert/Pictures/photo.jpg");
        }
    });

    it("should handle complex URL encoding", () => {
        const fileUrl = "file:///Users/Albert/Pictures/photo%2Bwith%2Bplus.jpg";
        const result = removeFileProtocol(fileUrl);
        expect(result).toBe("/Users/Albert/Pictures/photo+with+plus.jpg");
    });
});
