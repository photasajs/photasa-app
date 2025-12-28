import { describe, it, expect, beforeEach } from "vitest";
import { processFileGroup } from "../import-handler";
import type { FileGroup, FileInfo } from "@photasa/common";
import type { PhotasaLogger } from "@photasa/common";

const mockLogger: PhotasaLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
} as any;

describe("HEIC Date Validation Fix", () => {
    beforeEach(() => {
        // Clear any previous mocks
    });

    it("should handle invalid HEIC date and prevent NaN/NaNNaNNaN paths", async () => {
        const invalidDate = new Date("invalid-date-string");

        // 验证无效日期会产生 NaN
        expect(isNaN(invalidDate.getTime())).toBe(true);
        expect(invalidDate.getFullYear()).toBeNaN();
        expect(invalidDate.getMonth()).toBeNaN();
        expect(invalidDate.getDate()).toBeNaN();

        const fileInfo: FileInfo = {
            path: "/test/invalid-date.heic",
            name: "invalid-date.heic",
            size: 1024000,
            type: "image",
            dateSource: "exif",
            dateTime: invalidDate, // 使用无效的日期对象
            createdTime: undefined, // 没有文件创建时间
            modifiedTime: new Date(),
            // FileAction 兼容字段
            file: "/test/invalid-date.heic",
            isImage: true,
            isVideo: false,
            target: "",
            targetDir: "",
            targetFileName: "invalid-date.heic",
            targetFullPath: "",
        };

        const fileGroup: FileGroup = {
            mainFile: fileInfo,
            files: [fileInfo],
            type: "single",
            totalSize: 1024000,
        };

        const processedGroup = await processFileGroup(fileGroup, mockLogger);

        // 验证没有生成 NaN 路径
        expect(processedGroup.targetPath).toBeDefined();
        expect(processedGroup.targetPath).not.toContain("NaN");
        expect(processedGroup.targetPath).not.toBe("NaN/NaNNaNNaN");

        // 验证使用了今天的日期作为回退
        const today = new Date();
        const expectedYear = today.getFullYear().toString();
        const expectedMonth = String(today.getMonth() + 1).padStart(2, "0");
        const expectedDay = String(today.getDate()).padStart(2, "0");
        const expectedPath = `${expectedYear}/${expectedYear}${expectedMonth}${expectedDay}`;

        expect(processedGroup.targetPath).toBe(expectedPath);
    });

    it("should handle valid HEIC date correctly", async () => {
        const validDate = new Date("2023-08-15T14:30:00.000Z");

        const fileInfo: FileInfo = {
            path: "/test/valid-date.heic",
            name: "valid-date.heic",
            size: 2048000,
            type: "image",
            dateSource: "exif",
            dateTime: validDate,
            createdTime: new Date("2023-08-16T10:00:00.000Z"),
            modifiedTime: new Date(),
            // FileAction 兼容字段
            file: "/test/valid-date.heic",
            isImage: true,
            isVideo: false,
            target: "",
            targetDir: "",
            targetFileName: "valid-date.heic",
            targetFullPath: "",
        };

        const fileGroup: FileGroup = {
            mainFile: fileInfo,
            files: [fileInfo],
            type: "single",
            totalSize: 2048000,
        };

        const processedGroup = await processFileGroup(fileGroup, mockLogger);

        // 验证使用了正确的EXIF日期
        expect(processedGroup.targetPath).toBe("2023/20230815");
    });

    it("should handle multiple invalid dates in file group", async () => {
        const invalidDate1 = new Date("2023-13-45"); // 无效月份和日期
        const invalidDate2 = new Date("not-a-date"); // 完全无效的字符串

        // 验证这些日期都是无效的
        expect(isNaN(invalidDate1.getTime())).toBe(true);
        expect(isNaN(invalidDate2.getTime())).toBe(true);

        const fileInfos: FileInfo[] = [
            {
                path: "/test/invalid1.heic",
                name: "invalid1.heic",
                size: 1000000,
                type: "image",
                dateSource: "exif",
                dateTime: invalidDate1,
                createdTime: undefined,
                modifiedTime: new Date(),
                // FileAction 兼容字段
                file: "/test/invalid1.heic",
                isImage: true,
                isVideo: false,
                target: "",
                targetDir: "",
                targetFileName: "invalid1.heic",
                targetFullPath: "",
            },
            {
                path: "/test/invalid2.heic",
                name: "invalid2.heic",
                size: 1500000,
                type: "image",
                dateSource: "exif",
                dateTime: invalidDate2,
                createdTime: undefined,
                modifiedTime: new Date(),
                // FileAction 兼容字段
                file: "/test/invalid2.heic",
                isImage: true,
                isVideo: false,
                target: "",
                targetDir: "",
                targetFileName: "invalid2.heic",
                targetFullPath: "",
            },
        ];

        const fileGroup: FileGroup = {
            mainFile: fileInfos[0], // 主文件也有无效日期
            files: fileInfos,
            type: "group",
            totalSize: 2500000,
        };

        const processedGroup = await processFileGroup(fileGroup, mockLogger);

        // 验证即使所有文件都有无效日期，也能正确处理
        expect(processedGroup.targetPath).toBeDefined();
        expect(processedGroup.targetPath).not.toContain("NaN");

        // 应该使用今天的日期
        const today = new Date();
        const expectedYear = today.getFullYear().toString();
        expect(processedGroup.targetPath).toContain(expectedYear);
    });

    it("should handle edge case with null/undefined dates", async () => {
        const fileInfo: FileInfo = {
            path: "/test/no-date.heic",
            name: "no-date.heic",
            size: 500000,
            type: "image",
            dateSource: "file_created",
            dateTime: null as any, // 明确设置为 null
            createdTime: undefined, // 也没有创建时间
            modifiedTime: new Date(),
            // FileAction 兼容字段
            file: "/test/no-date.heic",
            isImage: true,
            isVideo: false,
            target: "",
            targetDir: "",
            targetFileName: "no-date.heic",
            targetFullPath: "",
        };

        const fileGroup: FileGroup = {
            mainFile: fileInfo,
            files: [fileInfo],
            type: "single",
            totalSize: 500000,
        };

        const processedGroup = await processFileGroup(fileGroup, mockLogger);

        // 验证处理 null/undefined 日期
        expect(processedGroup.targetPath).toBeDefined();
        expect(processedGroup.targetPath).not.toContain("NaN");
        expect(processedGroup.targetPath).not.toBe("undefined/undefinedundefinedundefined");

        // 应该使用今天的日期
        const today = new Date();
        const expectedYear = today.getFullYear().toString();
        expect(processedGroup.targetPath).toContain(expectedYear);
    });
});
