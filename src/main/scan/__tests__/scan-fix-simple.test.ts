/**
 * 扫描修复简单测试
 *
 * 简化的测试来验证修复功能是否正常工作
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { decideScanStrategy } from "../scan-strategy";
import { ScanStrategy } from "../folder-cache-manager";
import type { PhotasaLogger } from "@common/logger";

// Mock external dependencies
vi.mock("fs-extra");
vi.mock("@main/config/config-storage", () => ({
    getPhotasaConfig: vi.fn(),
}));
vi.mock("@main/scan/folder-cache-manager", () => ({
    computeFolderHash: vi.fn(),
    getCacheInfo: vi.fn(),
    compareHashesAndDecide: vi.fn(),
    ScanStrategy: {
        SKIP: "skip",
        INCREMENTAL: "incremental",
        FULL: "full",
    },
}));

const mockFs = fs as any;
const mockLogger: PhotasaLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
} as any;

describe("scan-fix-simple", () => {
    let tempDir: string;
    let testFolder: string;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `picasa-simple-test-${Date.now()}`);
        testFolder = path.join(tempDir, "test-folder");
        await fs.ensureDir(testFolder);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await fs.remove(tempDir);
    });

    describe("decideScanStrategy 修复验证", () => {
        it("应该在有有效 .photasa.json 时返回 SKIP 策略", async () => {
            // 创建有效的 .photasa.json 文件
            const configPath = path.join(testFolder, ".photasa.json");
            const validConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: [
                    { path: "photo1.jpg", thumbnail: "thumb1.jpg", isVideo: false },
                    { path: "photo2.jpg", thumbnail: "thumb2.jpg", isVideo: false },
                ],
            };
            await fs.writeFile(configPath, JSON.stringify(validConfig, null, 2));

            // Mock 外部依赖
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            (getPhotasaConfig as any).mockResolvedValue(validConfig);
            mockFs.existsSync.mockReturnValue(true);

            const result = await decideScanStrategy(testFolder, mockLogger);

            expect(result.strategy).toBe(ScanStrategy.SKIP);
            expect(result.reason).toBe("配置文件存在且有效，无需重新扫描");
        });

        it("应该在 .photasa.json 不存在时返回 FULL 策略", async () => {
            mockFs.existsSync.mockReturnValue(false);

            const result = await decideScanStrategy(testFolder, mockLogger);

            expect(result.strategy).toBe(ScanStrategy.FULL);
            expect(result.reason).toBe("配置文件不存在");
        });

        it("应该在强制重新扫描时返回 FULL 策略", async () => {
            const result = await decideScanStrategy(testFolder, mockLogger, "rescan");

            expect(result.strategy).toBe(ScanStrategy.FULL);
            expect(result.reason).toBe("强制重新扫描");
        });

        it("应该在配置文件为空时返回 SKIP 策略（如果文件夹无照片）", async () => {
            const configPath = path.join(testFolder, ".photasa.json");
            const emptyConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: [],
            };
            await fs.writeFile(configPath, JSON.stringify(emptyConfig, null, 2));

            // Mock 外部依赖
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            const { computeFolderHash } = await import("@main/scan/folder-cache-manager");

            (getPhotasaConfig as any).mockResolvedValue(emptyConfig);
            (computeFolderHash as any).mockResolvedValue(""); // 无照片文件
            mockFs.existsSync.mockReturnValue(true);

            const result = await decideScanStrategy(testFolder, mockLogger);

            expect(result.strategy).toBe(ScanStrategy.SKIP);
            expect(result.reason).toBe("配置文件为空且文件夹无照片");
        });
    });

    describe("修复效果验证", () => {
        it("应该不再依赖 .photasa-folder.json", async () => {
            // 创建有效的 .photasa.json 文件
            const configPath = path.join(testFolder, ".photasa.json");
            const validConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: [{ path: "photo1.jpg", thumbnail: "thumb1.jpg", isVideo: false }],
            };
            await fs.writeFile(configPath, JSON.stringify(validConfig, null, 2));

            // Mock 外部依赖
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            const { getCacheInfo } = await import("@main/scan/folder-cache-manager");

            (getPhotasaConfig as any).mockResolvedValue(validConfig);
            mockFs.existsSync.mockReturnValue(true);

            const result = await decideScanStrategy(testFolder, mockLogger);

            // 验证结果
            expect(result.strategy).toBe(ScanStrategy.SKIP);

            // 验证 getCacheInfo 没有被调用（因为不再依赖 .photasa-folder.json）
            expect(getCacheInfo).not.toHaveBeenCalled();
        });
    });
});
