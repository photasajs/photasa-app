/**
 * 测试修复后的子目录发现功能
 * 验证 DirectoryService 中 scanSubfolders 能正确发现子目录
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import DirectoryService from "../directory-service";
import fs from "fs";
import path from "path";
// import { loggers } from "@photasa/common";

// Mock dependencies
vi.mock("fs");
vi.mock("@photasa/common");

// const _mockLogger = loggers.main;

describe("DirectoryService Subdirectories Fix", () => {
    let directoryService: DirectoryService;
    let mockIpcMain: any;
    let mockMainWindow: any;
    let mockApp: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockIpcMain = {
            handle: vi.fn(),
            on: vi.fn(),
            removeAllListeners: vi.fn(),
        };

        mockMainWindow = {};
        mockApp = {
            getPath: vi.fn(),
        };

        directoryService = new DirectoryService(mockIpcMain, mockMainWindow, mockApp);
    });

    it("应该正确发现子目录", async () => {
        const testParentDir = "/test/photos";
        const mockSubDirs = ["subdir1", "subdir2", "vacation"];
        const mockFiles = ["photo.jpg", "video.mp4"];

        // Mock fs.existsSync
        vi.mocked(fs.existsSync).mockReturnValue(true);

        // Mock fs.readdirSync to return mixed files and directories
        vi.mocked(fs.readdirSync).mockReturnValue([
            ...mockSubDirs.map((name) => ({ name, isDirectory: () => true })),
            ...mockFiles.map((name) => ({ name, isDirectory: () => false })),
        ] as any);

        // Initialize service to register handlers
        await directoryService.initialize();

        // Get the handler function that was registered
        const handleCall = mockIpcMain.handle.mock.calls.find(
            (call: any[]) => call[0] === "picasa:sub-folders",
        );
        expect(handleCall).toBeDefined();

        const handler = handleCall[1];

        // Call the handler
        const result = await handler({}, { parent: testParentDir });

        // Verify results
        expect(result).toHaveLength(3);
        expect(result).toEqual([
            path.join(testParentDir, "subdir1"),
            path.join(testParentDir, "subdir2"),
            path.join(testParentDir, "vacation"),
        ]);

        // Verify fs calls
        expect(fs.existsSync).toHaveBeenCalledWith(testParentDir);
        expect(fs.readdirSync).toHaveBeenCalledWith(testParentDir, { withFileTypes: true });
    });

    it("应该排除隐藏目录", async () => {
        const testParentDir = "/test/photos";

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readdirSync).mockReturnValue([
            { name: "visible-dir", isDirectory: () => true },
            { name: ".hidden-dir", isDirectory: () => true },
            { name: ".photasa.json", isDirectory: () => false },
        ] as any);

        await directoryService.initialize();

        const handleCall = mockIpcMain.handle.mock.calls.find(
            (call: any[]) => call[0] === "picasa:sub-folders",
        );
        const handler = handleCall[1];
        const result = await handler({}, { parent: testParentDir });

        expect(result).toHaveLength(1);
        expect(result).toEqual([path.join(testParentDir, "visible-dir")]);
    });

    it("应该排除系统目录", async () => {
        const testParentDir = "/test/photos";

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readdirSync).mockReturnValue([
            { name: "photos", isDirectory: () => true },
            { name: "node_modules", isDirectory: () => true },
            { name: "Thumbs.db", isDirectory: () => true },
            { name: ".DS_Store", isDirectory: () => true },
        ] as any);

        await directoryService.initialize();

        const handleCall = mockIpcMain.handle.mock.calls.find(
            (call: any[]) => call[0] === "picasa:sub-folders",
        );
        const handler = handleCall[1];
        const result = await handler({}, { parent: testParentDir });

        expect(result).toHaveLength(1);
        expect(result).toEqual([path.join(testParentDir, "photos")]);
    });

    it("应该处理目录不存在的情况", async () => {
        const testParentDir = "/nonexistent/path";

        vi.mocked(fs.existsSync).mockReturnValue(false);

        await directoryService.initialize();

        const handleCall = mockIpcMain.handle.mock.calls.find(
            (call: any[]) => call[0] === "picasa:sub-folders",
        );
        const handler = handleCall[1];

        await expect(handler({}, { parent: testParentDir })).rejects.toThrow(
            `目录不存在: ${testParentDir}`,
        );
    });

    it("应该处理空目录", async () => {
        const testParentDir = "/test/empty";

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readdirSync).mockReturnValue([]);

        await directoryService.initialize();

        const handleCall = mockIpcMain.handle.mock.calls.find(
            (call: any[]) => call[0] === "picasa:sub-folders",
        );
        const handler = handleCall[1];
        const result = await handler({}, { parent: testParentDir });

        expect(result).toHaveLength(0);
        expect(result).toEqual([]);
    });
});
