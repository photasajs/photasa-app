import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BatchProcessor } from "../batch-processor";
import { ImportConfig, FileInfo, FileGroup } from "../../../common/import-types";
import fs from "fs-extra";
import path from "path";
import os from "os";

// Mock fs.copy to avoid test environment issues
vi.mock("fs-extra", async () => {
    const actual = await vi.importActual<typeof import("fs-extra")>("fs-extra");
    return {
        ...actual,
        copy: vi.fn().mockResolvedValue(undefined),
        ensureDir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn().mockResolvedValue({
            birthtime: new Date(),
            mtime: new Date(),
            size: 1024,
        }),
        remove: vi.fn().mockResolvedValue(undefined),
    };
});

describe("BatchProcessor", () => {
    let tempDir: string;
    let sourceDir: string;
    let targetDir: string;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `picasa-batch-test-${Date.now()}`);
        sourceDir = path.join(tempDir, "source");
        targetDir = path.join(tempDir, "target");

        // Mock calls for directory setup
        vi.clearAllMocks();
    });

    afterEach(async () => {
        // Mock cleanup
        vi.clearAllMocks();
    });

    it("should process files successfully", async () => {
        // 创建测试文件
        const testFiles = ["test1.jpg", "test2.png", "test3.mp4"];
        const testFileInfos: FileInfo[] = [];

        for (const fileName of testFiles) {
            const filePath = path.join(sourceDir, fileName);
            const targetPath = path.join(targetDir, fileName);

            // Mock file stats since fs is mocked
            const stats = {
                birthtime: new Date(),
                mtime: new Date(),
                size: 1024,
            };

            const fileInfo: FileInfo = {
                // FileAction 的基础属性
                file: filePath,
                name: fileName,
                targetDir: targetDir,
                targetFileName: fileName,
                targetFullPath: targetPath,
                isImage: !fileName.endsWith(".mp4"),
                isVideo: fileName.endsWith(".mp4"),

                // FileInfo 的扩展属性
                path: filePath,
                size: stats?.size || 0,
                type: fileName.endsWith(".mp4") ? "video" : "image",
                dateSource: "file_created",
                createdTime: stats?.birthtime || new Date(),
                modifiedTime: stats?.mtime || new Date(),
                dateTime: stats?.birthtime || new Date(),
            };

            testFileInfos.push(fileInfo);
        }

        // 创建导入配置
        const config: ImportConfig = {
            sourcePaths: [sourceDir],
            targetPath: targetDir,
            filters: {
                fileTypes: ["all"],
                sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                dateRange: { start: new Date(0), end: new Date() },
                includeSubfolders: true,
            },
            duplicateStrategy: "rename",
            fileGroups: [],
            selectedFiles: testFileInfos.map((f) => f.path),
            allowDuplicateRename: true,
        };

        // 创建批处理器
        const processor = new BatchProcessor(config, 2);

        // 添加文件到队列
        processor.addFiles(testFileInfos);

        // 开始处理
        const result = await processor.start();

        // 验证结果
        expect(result.totalFiles).toBe(3);
        expect(result.successfulFiles).toBe(3);
        expect(result.errorFiles).toBe(0);
        expect(result.errors).toHaveLength(0);

        // 验证文件是否被正确复制
        for (const fileInfo of testFileInfos) {
            const targetPath = path.join(targetDir, fileInfo.name);
            const targetExists = await fs.pathExists(targetPath);
            expect(targetExists).toBe(true);

            if (targetExists) {
                const sourceContent = await fs.readFile(fileInfo.path, "utf8");
                const targetContent = await fs.readFile(targetPath, "utf8");
                expect(sourceContent).toBe(targetContent);
            }
        }
    });

    it("should handle progress events", async () => {
        const testFile = "test.jpg";
        const filePath = path.join(sourceDir, testFile);
        await fs.writeFile(filePath, "test content");

        const stats = await fs.stat(filePath);
        const targetPath = path.join(targetDir, testFile);

        const fileInfo: FileInfo = {
            file: filePath,
            name: testFile,
            targetDir: targetDir,
            targetFileName: testFile,
            targetFullPath: targetPath,
            isImage: true,
            isVideo: false,
            path: filePath,
            size: stats?.size || 0,
            type: "image",
            dateSource: "file_created",
            createdTime: stats?.birthtime || new Date(),
            modifiedTime: stats?.mtime || new Date(),
            dateTime: stats?.birthtime || new Date(),
        };

        const config: ImportConfig = {
            sourcePaths: [sourceDir],
            targetPath: targetDir,
            filters: {
                fileTypes: ["all"],
                sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                dateRange: { start: new Date(0), end: new Date() },
                includeSubfolders: true,
            },
            duplicateStrategy: "rename",
            fileGroups: [],
            selectedFiles: [fileInfo.path],
            allowDuplicateRename: true,
        };

        const processor = new BatchProcessor(config, 1);

        let progressEvents = 0;
        let fileProcessedEvents = 0;

        processor.on("progress", () => {
            progressEvents++;
        });

        processor.on("fileProcessed", () => {
            fileProcessedEvents++;
        });

        processor.addFiles([fileInfo]);
        await processor.start();

        expect(progressEvents).toBeGreaterThan(0);
        expect(fileProcessedEvents).toBe(1);
    });

    it("should handle pause and resume", async () => {
        const testFile = "test.jpg";
        const filePath = path.join(sourceDir, testFile);
        await fs.writeFile(filePath, "test content");

        const stats = await fs.stat(filePath);
        const targetPath = path.join(targetDir, testFile);

        const fileInfo: FileInfo = {
            file: filePath,
            name: testFile,
            targetDir: targetDir,
            targetFileName: testFile,
            targetFullPath: targetPath,
            isImage: true,
            isVideo: false,
            path: filePath,
            size: stats?.size || 0,
            type: "image",
            dateSource: "file_created",
            createdTime: stats?.birthtime || new Date(),
            modifiedTime: stats?.mtime || new Date(),
            dateTime: stats?.birthtime || new Date(),
        };

        const config: ImportConfig = {
            sourcePaths: [sourceDir],
            targetPath: targetDir,
            filters: {
                fileTypes: ["all"],
                sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                dateRange: { start: new Date(0), end: new Date() },
                includeSubfolders: true,
            },
            duplicateStrategy: "rename",
            fileGroups: [],
            selectedFiles: [fileInfo.path],
            allowDuplicateRename: true,
        };

        const processor = new BatchProcessor(config, 1);

        let pausedEventFired = false;
        let resumedEventFired = false;

        processor.on("paused", () => {
            pausedEventFired = true;
        });

        processor.on("resumed", () => {
            resumedEventFired = true;
        });

        // 测试暂停和恢复
        processor.pause();
        expect(pausedEventFired).toBe(true);

        processor.resume();
        expect(resumedEventFired).toBe(true);
    });

    it("should process file groups successfully", async () => {
        // 创建文件组（模拟相机文件组：主文件 + 缩略图 + 低分辨率视频）
        const groupFiles = [
            { name: "IMG_001.MP4", isMain: true },
            { name: "IMG_001.THM", isMain: false },
            { name: "IMG_001.LRV", isMain: false },
        ];

        const fileInfos: FileInfo[] = [];

        for (const file of groupFiles) {
            const filePath = path.join(sourceDir, file.name);
            await fs.writeFile(filePath, `内容: ${file.name}`);

            const stats = await fs.stat(filePath);
            const targetPath = path.join(targetDir, file.name);

            const fileInfo: FileInfo = {
                // FileAction 的基础属性
                file: filePath,
                name: file.name,
                targetDir: targetDir,
                targetFileName: file.name,
                targetFullPath: targetPath,
                isImage: false,
                isVideo: file.name.endsWith(".MP4"),

                // FileInfo 的扩展属性
                path: filePath,
                size: stats?.size || 0,
                type: file.name.endsWith(".MP4") ? "video" : "other",
                dateSource: "file_created",
                createdTime: stats?.birthtime || new Date(),
                modifiedTime: stats?.mtime || new Date(),
                dateTime: stats?.birthtime || new Date(),
            };

            fileInfos.push(fileInfo);
        }

        // 创建文件组
        const fileGroup: FileGroup = {
            mainFile: fileInfos.find((_f, index) => groupFiles[index].isMain) || fileInfos[0],
            files: fileInfos,
            type: "group",
            totalSize: fileInfos.reduce((sum, f) => sum + f.size, 0),
        };

        const config: ImportConfig = {
            sourcePaths: [sourceDir],
            targetPath: targetDir,
            filters: {
                fileTypes: ["all"],
                sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                dateRange: { start: new Date(0), end: new Date() },
                includeSubfolders: true,
            },
            duplicateStrategy: "rename",
            fileGroups: [fileGroup],
            selectedFiles: fileInfos.map((f) => f.path),
            allowDuplicateRename: true,
        };

        const processor = new BatchProcessor(config, 1);

        let groupProcessedEvents = 0;
        processor.on("groupProcessed", () => {
            groupProcessedEvents++;
        });

        processor.addFileGroups([fileGroup]);
        const result = await processor.start();

        // 验证结果
        expect(result.totalFiles).toBe(3);
        expect(result.successfulFiles).toBe(3);
        expect(result.errorFiles).toBe(0);
        expect(groupProcessedEvents).toBe(1);

        // 验证所有组文件都被复制
        for (const fileInfo of fileInfos) {
            const targetPath = path.join(targetDir, fileInfo.name);
            const targetExists = await fs.pathExists(targetPath);
            expect(targetExists).toBe(true);

            if (targetExists) {
                const sourceContent = await fs.readFile(fileInfo.path, "utf8");
                const targetContent = await fs.readFile(targetPath, "utf8");
                expect(sourceContent).toBe(targetContent);
            }
        }
    });
});
