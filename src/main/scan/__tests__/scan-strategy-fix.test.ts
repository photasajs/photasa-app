/**
 * 扫描策略修复测试
 *
 * 测试 decideScanStrategy 函数的修复，验证当 .photasa.json 存在且有效时
 * 直接返回 SKIP 策略，不再依赖 .photasa-folder.json
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { decideScanStrategy } from "../strategy/scan-strategy";
import { ScanStrategy } from "../cache/folder-cache-manager";
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

describe("scan-strategy-fix", () => {
    let tempDir: string;
    let testFolder: string;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `picasa-scan-test-${Date.now()}`);
        testFolder = path.join(tempDir, "test-folder");
        await fs.ensureDir(testFolder);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await fs.remove(tempDir);
    });

    describe("decideScanStrategy 修复测试", () => {
        it("应该在有有效 .photasa.json 时直接返回 SKIP 策略", async () => {
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

            // Mock getPhotasaConfig 返回有效配置
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            (getPhotasaConfig as any).mockResolvedValue(validConfig);

            // Mock fs.existsSync 返回 true
            mockFs.existsSync.mockReturnValue(true);

            const result = await decideScanStrategy(testFolder, mockLogger);

            expect(result.strategy).toBe(ScanStrategy.SKIP);
            expect(result.reason).toBe("配置文件存在且有效，无需重新扫描");
            expect(mockLogger.info).toHaveBeenCalledWith(
                `[decideScanStrategy] .photasa.json 存在且有效，跳过扫描: ${testFolder}`,
            );
        });

        it("应该在 .photasa.json 不存在时返回 FULL 策略", async () => {
            // Mock fs.existsSync 返回 false
            mockFs.existsSync.mockReturnValue(false);

            const result = await decideScanStrategy(testFolder, mockLogger);

            expect(result.strategy).toBe(ScanStrategy.FULL);
            expect(result.reason).toBe("配置文件不存在");
            expect(mockLogger.info).toHaveBeenCalledWith(
                `[decideScanStrategy] .photasa.json 不存在: ${testFolder}`,
            );
        });

        it("应该在强制重新扫描时返回 FULL 策略", async () => {
            const result = await decideScanStrategy(testFolder, mockLogger, "rescan");

            expect(result.strategy).toBe(ScanStrategy.FULL);
            expect(result.reason).toBe("强制重新扫描");
            expect(mockLogger.info).toHaveBeenCalledWith(
                `[decideScanStrategy] 强制重新扫描: ${testFolder}`,
            );
        });

        it("应该在配置文件为空时返回 SKIP 策略（如果文件夹无照片）", async () => {
            const configPath = path.join(testFolder, ".photasa.json");
            const emptyConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: [],
            };
            await fs.writeFile(configPath, JSON.stringify(emptyConfig, null, 2));

            // Mock getPhotasaConfig 返回空配置
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            (getPhotasaConfig as any).mockResolvedValue(emptyConfig);

            // Mock fs.existsSync 返回 true
            mockFs.existsSync.mockReturnValue(true);

            // Mock computeFolderHash 返回空字符串（无照片文件）
            const { computeFolderHash } = await import("@main/scan/cache/folder-cache-manager");
            (computeFolderHash as any).mockResolvedValue("");

            const result = await decideScanStrategy(testFolder, mockLogger);

            expect(result.strategy).toBe(ScanStrategy.SKIP);
            expect(result.reason).toBe("配置文件为空且文件夹无照片");
        });

        it("应该在配置文件读取失败时返回 FULL 策略", async () => {
            // Mock fs.existsSync 返回 true
            mockFs.existsSync.mockReturnValue(true);

            // Mock getPhotasaConfig 抛出错误
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            (getPhotasaConfig as any).mockRejectedValue(new Error("读取失败"));

            const result = await decideScanStrategy(testFolder, mockLogger);

            expect(result.strategy).toBe(ScanStrategy.FULL);
            expect(result.reason).toBe("配置文件读取失败");
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `[decideScanStrategy] 读取 .photasa.json 失败: ${testFolder}`,
                expect.any(Error),
            );
        });
    });

    describe("修复效果验证", () => {
        it("应该不再依赖 .photasa-folder.json 进行决策", async () => {
            // 创建有效的 .photasa.json 文件
            const configPath = path.join(testFolder, ".photasa.json");
            const validConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: [{ path: "photo1.jpg", thumbnail: "thumb1.jpg", isVideo: false }],
            };
            await fs.writeFile(configPath, JSON.stringify(validConfig, null, 2));

            // Mock getPhotasaConfig 返回有效配置
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            (getPhotasaConfig as any).mockResolvedValue(validConfig);

            // Mock fs.existsSync 返回 true
            mockFs.existsSync.mockReturnValue(true);

            const result = await decideScanStrategy(testFolder, mockLogger);

            // 验证结果
            expect(result.strategy).toBe(ScanStrategy.SKIP);
            expect(result.reason).toBe("配置文件存在且有效，无需重新扫描");

            // 验证 getCacheInfo 没有被调用（因为不再依赖 .photasa-folder.json）
            const { getCacheInfo } = await import("@main/scan/cache/folder-cache-manager");
            expect(getCacheInfo).not.toHaveBeenCalled();
        });
    });
});
