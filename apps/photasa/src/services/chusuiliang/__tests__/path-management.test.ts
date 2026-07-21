/**
 * 褚遂良路径管理单元测试
 * 验证统一路径处理架构的正确性
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    validateAndNormalizePath,
    checkPathDuplication,
    isPathSafe,
    detectPathType,
    PathProcessingStats,
} from "../path-utils";

// Mock path utilities
vi.mock("@renderer/utils/path", () => ({
    normalizePath: vi.fn((path: string) => {
        // 模拟RFC 0012的路径规范化逻辑
        if (path.startsWith("file://")) {
            // 简单的file://协议处理
            return path.replace("file://", "").replace(/%3A/g, ":").replace(/%20/g, " ");
        }
        return path;
    }),
}));

vi.mock("@photasa/common", () => ({
    loggers: {
        chusuiliang: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    },
}));

describe("褚遂良路径管理测试", () => {
    beforeEach(() => {
        // 重置统计信息
        PathProcessingStats.getInstance().reset();
        vi.clearAllMocks();
    });

    describe("路径验证和规范化", () => {
        it("应该成功验证有效的系统路径", () => {
            const validPath = "/Users/test/documents";
            const result = validateAndNormalizePath(validPath);

            expect(result.isValid).toBe(true);
            expect(result.normalizedPath).toBe(validPath);
            expect(result.error).toBeUndefined();
        });

        it("应该成功处理file://协议路径", () => {
            const filePath = "file:///Users/test/documents";
            const result = validateAndNormalizePath(filePath);

            expect(result.isValid).toBe(true);
            expect(result.normalizedPath).toBe("/Users/test/documents");
            expect(result.error).toBeUndefined();
        });

        it("应该处理URL编码的路径", () => {
            const encodedPath = "file:///C%3A/Users/test%20folder";
            const result = validateAndNormalizePath(encodedPath);

            expect(result.isValid).toBe(true);
            expect(result.normalizedPath).toBe("/C:/Users/test folder");
            expect(result.error).toBeUndefined();
        });

        it("应该拒绝空路径", () => {
            const result = validateAndNormalizePath("");

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("路径不能为空");
        });

        it("应该拒绝过短的路径", () => {
            const result = validateAndNormalizePath("ab");

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("路径长度不足");
        });

        it("应该处理非字符串输入", () => {
            const result = validateAndNormalizePath(null as any);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("路径不能为空");
        });
    });

    describe("路径重复检查", () => {
        const existingPaths = [
            "/Users/test/documents",
            "/Users/test/pictures",
            "C:\\Users\\test\\music",
        ];

        it("应该检测到重复的路径", () => {
            const duplicatePath = "/Users/test/documents";
            const result = checkPathDuplication(duplicatePath, existingPaths);

            expect(result.isDuplicate).toBe(true);
            expect(result.normalizedPath).toBe(duplicatePath);
            expect(result.existingMatch).toBe("/Users/test/documents");
        });

        it("应该允许添加新路径", () => {
            const newPath = "/Users/test/downloads";
            const result = checkPathDuplication(newPath, existingPaths);

            expect(result.isDuplicate).toBe(false);
            expect(result.normalizedPath).toBe(newPath);
            expect(result.existingMatch).toBeUndefined();
        });

        it("应该检测到不同格式但相同的路径", () => {
            const duplicatePath = "file:///Users/test/documents";
            const result = checkPathDuplication(duplicatePath, existingPaths);

            expect(result.isDuplicate).toBe(true);
            expect(result.normalizedPath).toBe("/Users/test/documents");
        });

        it("应该处理无效路径", () => {
            const invalidPath = "";
            const result = checkPathDuplication(invalidPath, existingPaths);

            expect(result.isDuplicate).toBe(false);
            expect(result.normalizedPath).toBe("");
        });
    });

    describe("路径安全性检查", () => {
        it("应该接受安全的路径", () => {
            const safePaths = [
                "/Users/test/documents",
                "C:\\Users\\test\\pictures",
                "/Volumes/External/photos",
                "/home/user/files",
            ];

            safePaths.forEach((path) => {
                expect(isPathSafe(path)).toBe(true);
            });
        });

        it("应该拒绝包含父目录遍历的路径", () => {
            const unsafePaths = [
                "/Users/test/../../../etc/passwd",
                "C:\\Users\\test\\..\\..\\Windows\\System32",
                "../sensitive/files",
            ];

            unsafePaths.forEach((path) => {
                expect(isPathSafe(path)).toBe(false);
            });
        });

        it("应该拒绝包含双斜杠的路径", () => {
            const unsafePaths = [
                "/Users//test//documents",
                "C://Users//test", // 修改为更明确的双斜杠格式
            ];

            unsafePaths.forEach((path) => {
                expect(isPathSafe(path)).toBe(false);
            });
        });

        it("应该拒绝包含Windows非法字符的路径", () => {
            const unsafePaths = [
                "/Users/test/file<name",
                "/Users/test/file>name",
                "/Users/test/file|name",
                '/Users/test/file"name',
                "/Users/test/file?name",
                "/Users/test/file*name",
            ];

            unsafePaths.forEach((path) => {
                expect(isPathSafe(path)).toBe(false);
            });
        });

        it("应该拒绝仅根目录的路径", () => {
            const unsafePaths = ["C:\\", "C:\\ ", "/", "/ "];

            unsafePaths.forEach((path) => {
                expect(isPathSafe(path)).toBe(false);
            });
        });

        it("应该拒绝空路径", () => {
            expect(isPathSafe("")).toBe(false);
            expect(isPathSafe(null as any)).toBe(false);
            expect(isPathSafe(undefined as any)).toBe(false);
        });
    });

    describe("路径类型检测", () => {
        it("应该正确检测file://协议路径", () => {
            const testCases = [
                {
                    path: "file:///C%3A/Users/test",
                    expected: {
                        type: "file-protocol",
                        platform: "windows",
                        hasUrlEncoding: true,
                    },
                },
                {
                    path: "file:///Users/test",
                    expected: {
                        type: "file-protocol",
                        platform: "mac",
                        hasUrlEncoding: false,
                    },
                },
            ];

            testCases.forEach(({ path, expected }) => {
                const result = detectPathType(path);
                expect(result.type).toBe(expected.type);
                expect(result.platform).toBe(expected.platform);
                expect(result.hasUrlEncoding).toBe(expected.hasUrlEncoding);
            });
        });

        it("应该正确检测系统路径", () => {
            const testCases = [
                {
                    path: "C:\\Users\\test",
                    expected: {
                        type: "system-path",
                        platform: "windows",
                        hasUrlEncoding: false,
                    },
                },
                {
                    path: "/Users/test",
                    expected: {
                        type: "system-path",
                        platform: "mac",
                        hasUrlEncoding: false,
                    },
                },
                {
                    path: "/Volumes/External",
                    expected: {
                        type: "system-path",
                        platform: "mac",
                        hasUrlEncoding: false,
                    },
                },
            ];

            testCases.forEach(({ path, expected }) => {
                const result = detectPathType(path);
                expect(result.type).toBe(expected.type);
                expect(result.platform).toBe(expected.platform);
                expect(result.hasUrlEncoding).toBe(expected.hasUrlEncoding);
            });
        });

        it("应该检测URL编码", () => {
            const encodedPaths = [
                "file:///C%3A/Users/test%20folder",
                "/Users/test%20folder",
                "C:\\Users\\test%20folder",
            ];

            encodedPaths.forEach((path) => {
                const result = detectPathType(path);
                expect(result.hasUrlEncoding).toBe(true);
            });
        });

        it("应该处理空或无效路径", () => {
            const result = detectPathType("");
            expect(result.type).toBe("unknown");
            expect(result.hasUrlEncoding).toBe(false);
        });
    });

    describe("路径处理统计", () => {
        it("应该正确记录路径处理统计", () => {
            const stats = PathProcessingStats.getInstance();

            // 模拟路径处理
            const validResult = { isValid: true, normalizedPath: "/test/path" };
            const pathType = { type: "system-path" as const, hasUrlEncoding: false };

            stats.recordPathProcessing(validResult, pathType);

            const currentStats = stats.getStats();
            expect(currentStats.totalProcessed).toBe(1);
            expect(currentStats.validPaths).toBe(1);
            expect(currentStats.systemPaths).toBe(1);
        });

        it("应该记录不同类型的路径统计", () => {
            const stats = PathProcessingStats.getInstance();

            // 记录file协议路径
            stats.recordPathProcessing(
                { isValid: true, normalizedPath: "/test" },
                { type: "file-protocol", hasUrlEncoding: true },
            );

            // 记录系统路径
            stats.recordPathProcessing(
                { isValid: true, normalizedPath: "/test2" },
                { type: "system-path", hasUrlEncoding: false },
            );

            // 记录无效路径
            stats.recordPathProcessing(
                { isValid: false, normalizedPath: "" },
                { type: "unknown", hasUrlEncoding: false },
            );

            const currentStats = stats.getStats();
            expect(currentStats.totalProcessed).toBe(3);
            expect(currentStats.validPaths).toBe(2);
            expect(currentStats.invalidPaths).toBe(1);
            expect(currentStats.fileProtocolPaths).toBe(1);
            expect(currentStats.systemPaths).toBe(1);
            expect(currentStats.urlEncodedPaths).toBe(1);
        });

        it("应该能够重置统计信息", () => {
            const stats = PathProcessingStats.getInstance();

            // 记录一些统计
            stats.recordPathProcessing(
                { isValid: true, normalizedPath: "/test" },
                { type: "system-path", hasUrlEncoding: false },
            );
            stats.recordDuplication();

            // 重置统计
            stats.reset();

            const currentStats = stats.getStats();
            expect(currentStats.totalProcessed).toBe(0);
            expect(currentStats.duplicates).toBe(0);
        });

        it("应该正确记录重复路径统计", () => {
            const stats = PathProcessingStats.getInstance();

            stats.recordDuplication();
            stats.recordDuplication();

            const currentStats = stats.getStats();
            expect(currentStats.duplicates).toBe(2);
        });
    });

    describe("错误处理", () => {
        it("应该正确处理各种错误情况", () => {
            // 测试各种已知的错误情况
            const errorCases = [
                { input: "", expectedError: "路径不能为空" },
                { input: null, expectedError: "路径不能为空" },
                { input: undefined, expectedError: "路径不能为空" },
                { input: "ab", expectedError: "路径长度不足" },
            ];

            errorCases.forEach(({ input, expectedError }) => {
                const result = validateAndNormalizePath(input as any);
                expect(result.isValid).toBe(false);
                expect(result.error).toBe(expectedError);
            });
        });
    });

    describe("边界条件测试", () => {
        it("应该处理极长的路径", () => {
            const longPath = "/Users/test/" + "very-long-directory-name/".repeat(50) + "file.txt";
            const result = validateAndNormalizePath(longPath);

            // 应该能够处理长路径（符合RFC 0012的设计目标）
            expect(result.isValid).toBe(true);
        });

        it("应该处理包含特殊字符的路径", () => {
            const specialPaths = [
                "/Users/测试用户/文档",
                "/Users/test/файлы",
                "/Users/test/файлы.txt",
                "/Users/test/file name with spaces",
            ];

            specialPaths.forEach((path) => {
                const result = validateAndNormalizePath(path);
                expect(result.isValid).toBe(true);
            });
        });

        it("应该处理混合编码的路径", () => {
            const mixedPath = "file:///Users/测试%20用户/documents";
            const result = validateAndNormalizePath(mixedPath);

            expect(result.isValid).toBe(true);
            expect(result.normalizedPath).toContain("测试 用户");
        });
    });
});
