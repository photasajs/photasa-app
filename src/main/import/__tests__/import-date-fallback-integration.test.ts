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

describe("Import Date Fallback Integration", () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = path.join(__dirname, "temp-integration-test");
        await fs.ensureDir(tempDir);
    });

    afterAll(async () => {
        await fs.remove(tempDir);
    });

    it("should ensure all files get a valid targetPath", async () => {
        // 模拟各种情况的文件
        const testCases = [
            {
                name: "no-date.txt",
                hasDateTime: false,
                hasCreatedTime: false,
                description: "No date info",
            },
            {
                name: "created-only.jpg",
                hasDateTime: false,
                hasCreatedTime: true,
                description: "Creation time only",
            },
            {
                name: "full-metadata.mp4",
                hasDateTime: true,
                hasCreatedTime: true,
                description: "Full metadata",
            },
        ];

        for (const testCase of testCases) {
            const filePath = path.join(tempDir, testCase.name);
            await fs.writeFile(filePath, `Content for ${testCase.name}`);

            const fileInfo: FileInfo = {
                path: filePath,
                name: testCase.name,
                size: 100,
                type: testCase.name.endsWith(".mp4")
                    ? "video"
                    : testCase.name.endsWith(".jpg")
                      ? "image"
                      : "other",
                dateSource: "file_created",
                dateTime: testCase.hasDateTime ? new Date("2023-06-15T14:30:00.000Z") : undefined,
                createdTime: testCase.hasCreatedTime
                    ? new Date("2023-03-10T09:15:00.000Z")
                    : undefined,
                modifiedTime: new Date(),
                // FileAction 兼容字段
                file: filePath,
                isImage: testCase.name.endsWith(".jpg"),
                isVideo: testCase.name.endsWith(".mp4"),
                target: "",
                targetDir: "",
                targetFileName: testCase.name,
                targetFullPath: "",
            };

            const fileGroup: FileGroup = {
                mainFile: fileInfo,
                files: [fileInfo],
                type: "single",
                totalSize: 100,
            };

            const processedGroup = await processFileGroup(fileGroup, mockLogger);

            // 验证每个文件都有 targetPath
            expect(
                processedGroup.targetPath,
                `${testCase.description} should have targetPath`,
            ).toBeDefined();
            expect(
                processedGroup.targetPath,
                `${testCase.description} should have non-empty targetPath`,
            ).not.toBe("");

            // 验证 targetPath 格式
            const pathParts = (processedGroup.targetPath as string).split("/");
            expect(
                pathParts,
                `${testCase.description} should have correct path format`,
            ).toHaveLength(2);
            expect(pathParts[0], `${testCase.description} should have valid year`).toMatch(
                /^\d{4}$/,
            );
            expect(pathParts[1], `${testCase.description} should have valid date folder`).toMatch(
                /^\d{8}$/,
            );

            console.log(
                `✓ ${testCase.description}: ${testCase.name} → ${processedGroup.targetPath}`,
            );
        }
    });

    it("should handle edge cases gracefully", async () => {
        // 测试空文件组
        const emptyGroup: FileGroup = {
            mainFile: {
                path: "/non/existent/file.txt",
                name: "file.txt",
                size: 0,
                type: "other",
                dateSource: "file_created",
                // 所有日期都是 undefined
                dateTime: undefined,
                createdTime: undefined,
                modifiedTime: undefined,
                // FileAction 兼容字段
                file: "/non/existent/file.txt",
                isImage: false,
                isVideo: false,
                target: "",
                targetDir: "",
                targetFileName: "file.txt",
                targetFullPath: "",
            },
            files: [],
            type: "single",
            totalSize: 0,
        };

        // 添加主文件到 files 数组
        emptyGroup.files = [emptyGroup.mainFile];

        const processedGroup = await processFileGroup(emptyGroup, mockLogger);

        // 即使没有任何日期信息，也应该有 targetPath（使用今天的日期）
        expect(processedGroup.targetPath).toBeDefined();
        expect(processedGroup.targetPath).not.toBe("");

        const today = new Date();
        const expectedYear = today.getFullYear().toString();
        expect(processedGroup.targetPath).toContain(expectedYear);

        console.log(`✓ Edge case (no date info): ${processedGroup.targetPath}`);
    });
});
