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
import { decideScanStrategy } from "../scan-strategy";
import { ScanStrategy } from "../folder-cache-manager";
import type { PhotasaLogger } from "@common/logger";

// Mock external dependencies
vi.mock("fs-extra");
vi.mock("../config/config-storage");
vi.mock("../folder-cache-manager");

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
        tempDir = path.join(os.tmpdir(), `picasa-scan-strategy-test-${Date.now()}`);
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
            vi.mocked(getPhotasaConfig).mockResolvedValue(validConfig);

            // Mock fs.existsSync 返回 true
            mockFs.existsSync.mockReturnValue(true);

            const result = await decideScanStrategy(testFolder, mockLogger);

            expect(result.strategy).toBe(ScanStrategy.SKIP);
            expect(result.reason).toBe("配置文件存在且有效，无需重新扫描");
            expect(mockLogger.info).toHaveBeenCalledWith(
                `[decideScanStrategy] .photasa.json 存在且有效，跳过扫描: ${testFolder}`,
            );
        });

        it("应该在 .photasa.json 为空时返回 FULL 策略", async () => {
            // 创建空的 .photasa.json 文件
            const configPath = path.join(testFolder, ".photasa.json");
            const emptyConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: [],
            };
            await fs.writeFile(configPath, JSON.stringify(emptyConfig, null, 2));

            // Mock getPhotasaConfig 返回空配置
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockResolvedValue(emptyConfig);

            // Mock fs.existsSync 返回 true
            mockFs.existsSync.mockReturnValue(true);

            // Mock computeFolderHash 返回 null（无照片文件）
            const { computeFolderHash } = await import("../folder-cache-manager");
            vi.mocked(computeFolderHash).mockResolvedValue("");

            const result = await decideScanStrategy(testFolder, mockLogger);

            expect(result.strategy).toBe(ScanStrategy.SKIP);
            expect(result.reason).toBe("配置文件为空且文件夹无照片");
        });

        it("应该在 .photasa.json 为空但文件夹有照片时返回 FULL 策略", async () => {
            // 创建空的 .photasa.json 文件
            const configPath = path.join(testFolder, ".photasa.json");
            const emptyConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: [],
            };
            await fs.writeFile(configPath, JSON.stringify(emptyConfig, null, 2));

            // 创建一些照片文件
            await fs.writeFile(path.join(testFolder, "photo1.jpg"), "fake image data");
            await fs.writeFile(path.join(testFolder, "photo2.jpg"), "fake image data");

            // Mock getPhotasaConfig 返回空配置
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockResolvedValue(emptyConfig);

            // Mock fs.existsSync 返回 true
            mockFs.existsSync.mockReturnValue(true);

            // Mock computeFolderHash 返回有效哈希（有照片文件）
            const { computeFolderHash } = await import("../folder-cache-manager");
            vi.mocked(computeFolderHash).mockResolvedValue("valid-hash");

            const result = await decideScanStrategy(testFolder, mockLogger);

            expect(result.strategy).toBe(ScanStrategy.FULL);
            expect(result.reason).toBe("配置文件为空但文件夹有照片");
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

        it("应该在配置文件读取失败时返回 FULL 策略", async () => {
            // Mock fs.existsSync 返回 true
            mockFs.existsSync.mockReturnValue(true);

            // Mock getPhotasaConfig 抛出错误
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockRejectedValue(new Error("读取失败"));

            const result = await decideScanStrategy(testFolder, mockLogger);

            expect(result.strategy).toBe(ScanStrategy.FULL);
            expect(result.reason).toBe("配置文件读取失败");
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `[decideScanStrategy] 读取 .photasa.json 失败: ${testFolder}`,
                expect.any(Error),
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
            vi.mocked(getPhotasaConfig).mockResolvedValue(validConfig);

            // Mock fs.existsSync 返回 true
            mockFs.existsSync.mockReturnValue(true);

            // 确保不会调用 getCacheInfo（因为不再依赖 .photasa-folder.json）
            const { getCacheInfo } = await import("../folder-cache-manager");
            const getCacheInfoSpy = vi.mocked(getCacheInfo);

            const result = await decideScanStrategy(testFolder, mockLogger);

            expect(result.strategy).toBe(ScanStrategy.SKIP);
            expect(getCacheInfoSpy).not.toHaveBeenCalled();
        });
    });

    describe("性能测试", () => {
        it("应该快速处理有大量照片的配置文件", async () => {
            // 创建包含大量照片的配置
            const largePhotoList = Array.from({ length: 1000 }, (_, i) => ({
                path: `photo${i}.jpg`,
                thumbnail: `thumb${i}.jpg`,
                isVideo: false,
            }));

            const configPath = path.join(testFolder, ".photasa.json");
            const largeConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: largePhotoList,
            };
            await fs.writeFile(configPath, JSON.stringify(largeConfig, null, 2));

            // Mock getPhotasaConfig 返回大配置
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockResolvedValue(largeConfig);

            // Mock fs.existsSync 返回 true
            mockFs.existsSync.mockReturnValue(true);

            const startTime = Date.now();
            const result = await decideScanStrategy(testFolder, mockLogger);
            const endTime = Date.now();

            expect(result.strategy).toBe(ScanStrategy.SKIP);
            expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
        });
    });
});
