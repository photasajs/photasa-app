/**
 * 测试重命名策略修复
 * 验证重命名策略能正确创建重命名文件而不是跳过
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import { tmpdir } from "os";
import { RenameDuplicateHandler } from "../duplicate-handler";
// import { performFileImport } from "../import-worker"; // Not exported
// import type { FileGroup, ImportConfig } from "@photasa/common";

describe("Rename Strategy Fix", () => {
    let tempDir: string;
    let sourceFile: string;
    let targetDir: string;
    let existingFile: string;

    beforeEach(async () => {
        // 创建临时目录
        tempDir = await fs.mkdtemp(path.join(tmpdir(), "rename-test-"));
        sourceFile = path.join(tempDir, "source", "test-photo.jpg");
        targetDir = path.join(tempDir, "target");
        existingFile = path.join(targetDir, "test-photo.jpg");

        // 设置测试文件
        await fs.ensureDir(path.dirname(sourceFile));
        await fs.ensureDir(targetDir);

        // 创建源文件
        await fs.writeFile(sourceFile, "test content");

        // 创建已存在的目标文件
        await fs.writeFile(existingFile, "existing content");
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.remove(tempDir);
        }
    });

    it("should create renamed file when duplicate exists", async () => {
        const handler = new RenameDuplicateHandler();

        const originalFile = {
            path: existingFile,
            name: "test-photo.jpg",
            size: 100,
            type: "image" as const,
            modifiedTime: new Date(),
            createdTime: new Date(),
            dateSource: "file_created" as const,
            file: existingFile,
            isImage: true,
            isVideo: false,
            targetDir: targetDir,
            targetFileName: "test-photo.jpg",
            targetFullPath: existingFile,
        };

        const duplicateFile = {
            path: sourceFile,
            name: "test-photo.jpg",
            size: 100,
            type: "image" as const,
            modifiedTime: new Date(),
            createdTime: new Date(),
            dateSource: "file_created" as const,
            file: sourceFile,
            isImage: true,
            isVideo: false,
            targetDir: targetDir,
            targetFileName: "test-photo.jpg",
            targetFullPath: path.join(targetDir, "test-photo.jpg"),
        };

        const result = await handler.handle(originalFile, duplicateFile, existingFile);

        expect(result.action).toBe("rename");
        expect(result.newPath).toBeDefined();
        expect(result.newPath).toContain("test-photo_1.jpg");
        expect(result.message).toContain("Renamed to:");
    });

    it("should generate sequential names for multiple duplicates", async () => {
        const handler = new RenameDuplicateHandler();

        // 创建多个重名文件
        await fs.writeFile(path.join(targetDir, "test-photo_1.jpg"), "dup1");
        await fs.writeFile(path.join(targetDir, "test-photo_2.jpg"), "dup2");

        const originalFile = {
            path: existingFile,
            name: "test-photo.jpg",
            size: 100,
            type: "image" as const,
            modifiedTime: new Date(),
            createdTime: new Date(),
            dateSource: "file_created" as const,
            file: existingFile,
            isImage: true,
            isVideo: false,
            targetDir: targetDir,
            targetFileName: "test-photo.jpg",
            targetFullPath: existingFile,
        };

        const duplicateFile = {
            path: sourceFile,
            name: "test-photo.jpg",
            size: 100,
            type: "image" as const,
            modifiedTime: new Date(),
            createdTime: new Date(),
            dateSource: "file_created" as const,
            file: sourceFile,
            isImage: true,
            isVideo: false,
            targetDir: targetDir,
            targetFileName: "test-photo.jpg",
            targetFullPath: path.join(targetDir, "test-photo.jpg"),
        };

        const result = await handler.handle(originalFile, duplicateFile, existingFile);

        expect(result.action).toBe("rename");
        expect(result.newPath).toContain("test-photo_3.jpg");
    });

    it("should verify rename handler generates correct path pattern", async () => {
        const handler = new RenameDuplicateHandler();

        const originalFile = {
            path: existingFile,
            name: "test-photo.jpg",
            size: 100,
            type: "image" as const,
            modifiedTime: new Date(),
            createdTime: new Date(),
            dateSource: "file_created" as const,
            file: existingFile,
            isImage: true,
            isVideo: false,
            targetDir: targetDir,
            targetFileName: "test-photo.jpg",
            targetFullPath: existingFile,
        };

        const duplicateFile = {
            path: sourceFile,
            name: "test-photo.jpg",
            size: 100,
            type: "image" as const,
            modifiedTime: new Date(),
            createdTime: new Date(),
            dateSource: "file_created" as const,
            file: sourceFile,
            isImage: true,
            isVideo: false,
            targetDir: targetDir,
            targetFileName: "test-photo.jpg",
            targetFullPath: path.join(targetDir, "test-photo.jpg"),
        };

        const result = await handler.handle(originalFile, duplicateFile, existingFile);

        expect(result.action).toBe("rename");
        expect(result.newPath).toBeDefined();
        expect(result.newPath).toBeTruthy();
        expect(path.dirname(result.newPath as string)).toBe(path.dirname(existingFile));
        expect(path.basename(result.newPath as string)).toMatch(/test-photo_\d+\.jpg/);
        expect(result.originalPath).toBe(originalFile.path);
        expect(result.message).toMatch(/Renamed to: test-photo_\d+\.jpg/);
    });
});
