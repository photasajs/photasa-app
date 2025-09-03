import { describe, it, expect } from "vitest";
import { normalizeFileProtocolPath } from "../path-util";

describe("normalizeFileProtocolPath", () => {
    it("should handle Unix file:// URLs correctly", () => {
        const input = "file:///Users/test/image.jpg";
        const result = normalizeFileProtocolPath(input);
        expect(result).toBe("/Users/test/image.jpg");
    });

    it("should handle Windows file:// URLs correctly", () => {
        const input = "file:///C:/Users/test/image.jpg";
        const result = normalizeFileProtocolPath(input);
        expect(result).toBe("C:/Users/test/image.jpg");
    });

    it("should handle multiple slashes after file://", () => {
        const input = "file:////Users/test/image.jpg";
        const result = normalizeFileProtocolPath(input);
        expect(result).toBe("/Users/test/image.jpg");
    });

    it("should handle Windows paths with different drive letters", () => {
        expect(normalizeFileProtocolPath("file:///D:/Projects/photo.jpg")).toBe("D:/Projects/photo.jpg");
        expect(normalizeFileProtocolPath("file:///E:/Backup/file.heic")).toBe("E:/Backup/file.heic");
    });

    it("should fix Mac external volume paths", () => {
        // Mac 外部卷路径缺少前导斜杠
        const input = "file://Volumes/SUCAI/Backup/image.heic";
        const result = normalizeFileProtocolPath(input);
        expect(result).toBe("/Volumes/SUCAI/Backup/image.heic");
    });

    it("should not modify regular paths", () => {
        expect(normalizeFileProtocolPath("/Users/test/image.jpg")).toBe("/Users/test/image.jpg");
        expect(normalizeFileProtocolPath("C:\\Users\\test\\image.jpg")).toBe("C:\\Users\\test\\image.jpg");
        expect(normalizeFileProtocolPath("./relative/path.jpg")).toBe("./relative/path.jpg");
    });

    it("should handle empty input", () => {
        expect(normalizeFileProtocolPath("")).toBe("");
        expect(normalizeFileProtocolPath(null as any)).toBe("");
        expect(normalizeFileProtocolPath(undefined as any)).toBe("");
    });

    it("should handle the original problematic cases", () => {
        // 原始问题场景
        const macVolume = "file://Volumes/SUCAI/Backup/2021/20210101/20210102_030833820_iOS.heic";
        expect(normalizeFileProtocolPath(macVolume)).toBe("/Volumes/SUCAI/Backup/2021/20210101/20210102_030833820_iOS.heic");
        
        const windowsPath = "file:///C:/Users/Albert/Pictures/photo.jpg";
        expect(normalizeFileProtocolPath(windowsPath)).toBe("C:/Users/Albert/Pictures/photo.jpg");
    });

    it("should handle edge cases", () => {
        // 只有 file:// 前缀
        expect(normalizeFileProtocolPath("file://")).toBe("");
        expect(normalizeFileProtocolPath("file:///")).toBe("");
        
        // 特殊字符
        expect(normalizeFileProtocolPath("file:///Users/test/图片/照片.jpg")).toBe("/Users/test/图片/照片.jpg");
        expect(normalizeFileProtocolPath("file:///C:/Users/test/特殊@#$.jpg")).toBe("C:/Users/test/特殊@#$.jpg");
    });
});