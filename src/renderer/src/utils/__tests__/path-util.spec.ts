import { describe, it, expect } from "vitest";
import { normalizePath } from "../path-util";

describe("normalizePath", () => {
    it("should handle Unix file:// URLs correctly", () => {
        const input = "file:///Users/test/image.jpg";
        const result = normalizePath(input);
        expect(result).toBe("/Users/test/image.jpg");
    });

    it("should handle Windows file:// URLs correctly", () => {
        const input = "file:///C:/Users/test/image.jpg";
        const result = normalizePath(input);
        expect(result).toBe("C:/Users/test/image.jpg");
    });

    it("should handle multiple slashes after file://", () => {
        const input = "file:////Users/test/image.jpg";
        const result = normalizePath(input);
        expect(result).toBe("/Users/test/image.jpg");
    });

    it("should handle Windows paths with different drive letters", () => {
        expect(normalizePath("file:///D:/Projects/photo.jpg")).toBe("D:/Projects/photo.jpg");
        expect(normalizePath("file:///E:/Backup/file.heic")).toBe("E:/Backup/file.heic");
    });

    it("should fix Mac external volume paths", () => {
        // Mac 外部卷路径缺少前导斜杠
        const input = "file://Volumes/SUCAI/Backup/image.heic";
        const result = normalizePath(input);
        expect(result).toBe("/Volumes/SUCAI/Backup/image.heic");
    });

    it("should not modify regular paths", () => {
        expect(normalizePath("/Users/test/image.jpg")).toBe("/Users/test/image.jpg");
        expect(normalizePath("C:\\Users\\test\\image.jpg")).toBe("C:\\Users\\test\\image.jpg");
        expect(normalizePath("./relative/path.jpg")).toBe("./relative/path.jpg");
    });

    it("should handle empty input", () => {
        expect(normalizePath("")).toBe("");
        expect(normalizePath(null as any)).toBe("");
        expect(normalizePath(undefined as any)).toBe("");
    });

    it("should handle the original problematic cases", () => {
        // 原始问题场景
        const macVolume = "file://Volumes/SUCAI/Backup/2021/20210101/20210102_030833820_iOS.heic";
        expect(normalizePath(macVolume)).toBe(
            "/Volumes/SUCAI/Backup/2021/20210101/20210102_030833820_iOS.heic",
        );

        const windowsPath = "file:///C:/Users/Albert/Pictures/photo.jpg";
        expect(normalizePath(windowsPath)).toBe("C:/Users/Albert/Pictures/photo.jpg");
    });

    it("should handle edge cases", () => {
        // 只有 file:// 前缀
        expect(normalizePath("file://")).toBe("");
        expect(normalizePath("file:///")).toBe("");

        // 特殊字符
        expect(normalizePath("file:///Users/test/图片/照片.jpg")).toBe("/Users/test/图片/照片.jpg");
        expect(normalizePath("file:///C:/Users/test/特殊@#$.jpg")).toBe(
            "C:/Users/test/特殊@#$.jpg",
        );
    });

    it("should decode URL-encoded characters", () => {
        // 测试URL编码的冒号（%3A）
        const encodedWindowsPath =
            "file:///C%3A/Users/alber/Desktop/Test/2024/20240101/20240102_051203000_iOS.jpg";
        expect(normalizePath(encodedWindowsPath)).toBe(
            "C:/Users/alber/Desktop/Test/2024/20240101/20240102_051203000_iOS.jpg",
        );

        // 测试URL编码的空格（%20）
        const encodedSpacePath = "file:///Users/test/My%20Photos/image.jpg";
        expect(normalizePath(encodedSpacePath)).toBe("/Users/test/My Photos/image.jpg");

        // 测试URL编码的特殊字符
        const encodedSpecialPath = "file:///Users/test/图片%20照片/image.jpg";
        expect(normalizePath(encodedSpecialPath)).toBe("/Users/test/图片 照片/image.jpg");
    });

    it("should handle malformed URL encoding gracefully", () => {
        // 测试无效的URL编码
        const malformedPath = "file:///C%3G/Users/test/image.jpg"; // %3G 是无效的编码
        const result = normalizePath(malformedPath);
        // 应该返回原始路径（解码失败时的回退），但会添加前导斜杠
        expect(result).toBe("/C%3G/Users/test/image.jpg");
    });
});
