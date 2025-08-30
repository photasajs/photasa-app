import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { processFileGroup } from "../import-handler";
import type { FileGroup, FileInfo } from "@common/import-types";
import type { PhotasaLogger } from "@common/logger";
import path from "path";
import fs from "fs-extra";

const mockLogger: PhotasaLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
} as any;

describe("processFileGroup Date Fallback Tests", () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = path.join(__dirname, "temp-test-date-fallback");
        await fs.ensureDir(tempDir);
    });

    afterAll(async () => {
        await fs.remove(tempDir);
    });

    it("should use today's date when no date information is available", async () => {
        const testFile = "no-date-file.txt";
        const filePath = path.join(tempDir, testFile);
        await fs.writeFile(filePath, "test content without date");

        const fileInfo: FileInfo = {
            path: filePath,
            name: testFile,
            size: 100,
            type: "other",
            dateSource: "file_created",
            // 故意不设置任何日期信息
            dateTime: undefined,
            createdTime: undefined,
            modifiedTime: undefined,
            // FileAction 兼容字段
            file: filePath,
            isImage: false,
            isVideo: false,
            target: "",
            targetDir: "",
            targetFileName: testFile,
            targetFullPath: "",
        };

        const fileGroup: FileGroup = {
            mainFile: fileInfo,
            files: [fileInfo],
            type: "single",
            totalSize: 100,
        };

        const processedGroup = await processFileGroup(fileGroup, mockLogger);

        // 验证生成了 targetPath
        expect(processedGroup.targetPath).toBeDefined();
        expect(processedGroup.targetPath).not.toBe("");

        // 验证 targetPath 格式是 YYYY/YYYYMMDD
        const pathParts = (processedGroup.targetPath as string).split("/");
        expect(pathParts).toHaveLength(2);

        const year = pathParts[0];
        const dateFolder = pathParts[1];

        // 验证年份格式
        expect(year).toMatch(/^\d{4}$/);

        // 验证日期文件夹格式 YYYYMMDD
        expect(dateFolder).toMatch(/^\d{8}$/);

        // 验证是今天的日期
        const today = new Date();
        const expectedYear = today.getFullYear().toString();
        const expectedMonth = String(today.getMonth() + 1).padStart(2, "0");
        const expectedDay = String(today.getDate()).padStart(2, "0");
        const expectedDateFolder = `${expectedYear}${expectedMonth}${expectedDay}`;

        expect(year).toBe(expectedYear);
        expect(dateFolder).toBe(expectedDateFolder);
    });

    it("should use file creation date when available", async () => {
        const testFile = "with-creation-date.txt";
        const filePath = path.join(tempDir, testFile);
        await fs.writeFile(filePath, "test content with creation date");

        // 设置一个特定的创建时间
        const specificDate = new Date("2023-05-15T10:30:00.000Z");

        const fileInfo: FileInfo = {
            path: filePath,
            name: testFile,
            size: 100,
            type: "other",
            dateSource: "file_created",
            dateTime: undefined, // 没有元数据日期
            createdTime: specificDate, // 有文件创建时间
            modifiedTime: new Date(),
            // FileAction 兼容字段
            file: filePath,
            isImage: false,
            isVideo: false,
            target: "",
            targetDir: "",
            targetFileName: testFile,
            targetFullPath: "",
        };

        const fileGroup: FileGroup = {
            mainFile: fileInfo,
            files: [fileInfo],
            type: "single",
            totalSize: 100,
        };

        const processedGroup = await processFileGroup(fileGroup, mockLogger);

        // 验证使用了文件创建日期
        expect(processedGroup.targetPath).toBe("2023/20230515");
    });

    it("should prefer metadata date over creation date", async () => {
        const testFile = "with-metadata-date.txt";
        const filePath = path.join(tempDir, testFile);
        await fs.writeFile(filePath, "test content with metadata date");

        const metadataDate = new Date("2022-12-25T15:45:00.000Z");
        const creationDate = new Date("2023-05-15T10:30:00.000Z");

        const fileInfo: FileInfo = {
            path: filePath,
            name: testFile,
            size: 100,
            type: "image",
            dateSource: "exif",
            dateTime: metadataDate, // 有元数据日期
            createdTime: creationDate, // 也有文件创建时间
            modifiedTime: new Date(),
            // FileAction 兼容字段
            file: filePath,
            isImage: true,
            isVideo: false,
            target: "",
            targetDir: "",
            targetFileName: testFile,
            targetFullPath: "",
        };

        const fileGroup: FileGroup = {
            mainFile: fileInfo,
            files: [fileInfo],
            type: "single",
            totalSize: 100,
        };

        const processedGroup = await processFileGroup(fileGroup, mockLogger);

        // 验证使用了元数据日期（优先级更高）
        expect(processedGroup.targetPath).toBe("2022/20221225");
    });

    it("should handle file groups with multiple files", async () => {
        const mainFile = "main-video.mp4";
        const thumbnailFile = "main-video.thm";
        const mainFilePath = path.join(tempDir, mainFile);
        const thumbnailFilePath = path.join(tempDir, thumbnailFile);

        await fs.writeFile(mainFilePath, "main video content");
        await fs.writeFile(thumbnailFilePath, "thumbnail content");

        const specificDate = new Date("2024-01-01T12:00:00.000Z");

        const mainFileInfo: FileInfo = {
            path: mainFilePath,
            name: mainFile,
            size: 1000,
            type: "video",
            dateSource: "exif",
            dateTime: specificDate,
            createdTime: new Date(),
            modifiedTime: new Date(),
            // FileAction 兼容字段
            file: mainFilePath,
            isImage: false,
            isVideo: true,
            target: "",
            targetDir: "",
            targetFileName: mainFile,
            targetFullPath: "",
        };

        const thumbnailFileInfo: FileInfo = {
            path: thumbnailFilePath,
            name: thumbnailFile,
            size: 50,
            type: "other",
            dateSource: "file_created",
            dateTime: undefined, // 缩略图没有日期
            createdTime: new Date(),
            modifiedTime: new Date(),
            // FileAction 兼容字段
            file: thumbnailFilePath,
            isImage: false,
            isVideo: false,
            target: "",
            targetDir: "",
            targetFileName: thumbnailFile,
            targetFullPath: "",
        };

        const fileGroup: FileGroup = {
            mainFile: mainFileInfo,
            files: [mainFileInfo, thumbnailFileInfo],
            type: "group",
            totalSize: 1050,
        };

        const processedGroup = await processFileGroup(fileGroup, mockLogger);

        // 验证使用了主文件的日期
        expect(processedGroup.targetPath).toBe("2024/20240101");
    });
});
