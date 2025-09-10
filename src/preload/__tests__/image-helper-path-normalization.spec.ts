import { describe, it, expect } from "vitest";
import { normalizePath } from "@shared/path-util";

describe("normalizePath in preload", () => {
    it("should decode URL-encoded Windows paths", () => {
        const encodedPath =
            "file:///C%3A/Users/alber/Desktop/Test/2024/20240101/20240102_051203000_iOS.jpg";
        const result = normalizePath(encodedPath);

        // 应该正确解码URL编码的路径（使用平台无关的路径分隔符）
        expect(result.replace(/\\/g, "/")).toContain(
            "Users/alber/Desktop/Test/2024/20240101/20240102_051203000_iOS.jpg",
        );
        // 应该包含盘符
        expect(result).toContain("C:");
    });

    it("should handle Mac paths correctly", () => {
        const macPath = "file:///Users/test/photo.jpg";
        const result = normalizePath(macPath);
        // 在Windows上，file:///Users/ 会被解析为相对路径
        expect(result.replace(/\\/g, "/")).toContain("Users/test/photo.jpg");
    });

    it("should handle Windows paths correctly", () => {
        const windowsPath = "file:///C:/Users/test/photo.jpg";
        const result = normalizePath(windowsPath);

        // 应该正确解析Windows路径
        expect(result.replace(/\\/g, "/")).toContain("Users/test/photo.jpg");
        expect(result).toContain("C:");
    });

    it("should handle URL-encoded spaces", () => {
        const encodedPath = "file:///Users/test/My%20Photos/image.jpg";
        const result = normalizePath(encodedPath);
        // 应该正确解码URL编码的空格
        expect(result).toContain("My Photos");
        expect(result.replace(/\\/g, "/")).toContain("Users/test");
    });

    it("should handle non-file URLs", () => {
        const regularPath = "/Users/test/photo.jpg";
        const result = normalizePath(regularPath);
        // 在Windows上，以 / 开头的路径会被解析为相对路径
        expect(result.replace(/\\/g, "/")).toContain("Users/test/photo.jpg");
    });

    it("should handle empty input", () => {
        expect(normalizePath("")).toBe("");
        expect(normalizePath(null as any)).toBe("");
        expect(normalizePath(undefined as any)).toBe("");
    });
});
