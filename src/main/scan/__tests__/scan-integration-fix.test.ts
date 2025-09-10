/**
 * 扫描集成修复测试
 *
 * 测试整个扫描流程的修复效果，验证从 UI 请求到文件处理的
 * 完整流程中，已扫描的文件夹能够被正确跳过
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
vi.mock("@main/config/config-storage");

const mockFs = vi.mocked(fs);

// Mock getPhotasaConfig
vi.doMock("@main/config/config-storage", () => ({
    getPhotasaConfig: vi.fn(),
}));
const mockLogger: PhotasaLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

describe("scan-integration-fix", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("完整扫描流程测试", () => {
        it("应该跳过已扫描的文件夹并扫描新文件夹", async () => {
            const scannedFolder = "/test/scanned";
            const newFolder = "/test/new";
            const scannedConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: [{ path: "/test/scanned/photo1.jpg", name: "photo1.jpg" }],
            };

            // 设置 mock 行为
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockImplementation((folderPath) => {
                if (folderPath === scannedFolder) {
                    return Promise.resolve(scannedConfig);
                }
                return Promise.resolve(null);
            });

            mockFs.existsSync.mockReturnValue(true);

            // 测试扫描策略决策
            const result1 = await decideScanStrategy(scannedFolder, mockLogger);
            const result2 = await decideScanStrategy(newFolder, mockLogger);

            expect(result1.strategy).toBe(ScanStrategy.SKIP);
            expect(result2.strategy).toBe(ScanStrategy.FULL);
        });

        it("应该处理混合场景：部分文件夹已扫描，部分需要扫描", async () => {
            const folders = [
                { path: "/test/scanned1", hasConfig: true },
                { path: "/test/scanned2", hasConfig: true },
                { path: "/test/new1", hasConfig: false },
                { path: "/test/new2", hasConfig: false },
            ];

            // 设置 mock 行为
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockImplementation((folderPath) => {
                const folder = folders.find((f) => f.path === folderPath);
                if (folder?.hasConfig) {
                    return Promise.resolve({
                        version: "1.0",
                        lastModified: Date.now(),
                        photoList: [],
                    });
                }
                return Promise.resolve(null);
            });

            mockFs.existsSync.mockReturnValue(true);

            // 测试所有文件夹的扫描策略
            for (const folder of folders) {
                const result = await decideScanStrategy(folder.path, mockLogger);
                if (folder.hasConfig) {
                    expect(result.strategy).toBe(ScanStrategy.SKIP);
                } else {
                    expect(result.strategy).toBe(ScanStrategy.FULL);
                }
            }
        });

        it("应该正确处理损坏的配置文件", async () => {
            const corruptedFolder = "/test/corrupted";

            const mockGetPhotasaConfig = vi.fn();
            vi.doMock("@main/config/config-storage", () => ({
                getPhotasaConfig: mockGetPhotasaConfig,
            }));

            mockGetPhotasaConfig.mockRejectedValue(new Error("JSON 解析失败"));

            mockFs.existsSync.mockReturnValue(true);

            // 损坏的配置文件应该触发完整扫描
            const result = await decideScanStrategy(corruptedFolder, mockLogger);

            expect(result.strategy).toBe(ScanStrategy.FULL);
            expect(result.reason).toContain("配置文件读取失败");
        });
    });

    describe("性能集成测试", () => {
        it("应该快速处理大量已扫描的文件夹", async () => {
            const folders = Array.from({ length: 100 }, (_, i) => `/test/folder${i}`);

            const mockGetPhotasaConfig = vi.fn();
            vi.doMock("@main/config/config-storage", () => ({
                getPhotasaConfig: mockGetPhotasaConfig,
            }));

            mockGetPhotasaConfig.mockResolvedValue({
                version: "1.0",
                lastModified: Date.now(),
                photoList: [],
            });

            mockFs.existsSync.mockReturnValue(true);

            const startTime = Date.now();

            // 测试所有文件夹的扫描策略决策
            for (const folder of folders) {
                const result = await decideScanStrategy(folder, mockLogger);
                expect(result.strategy).toBe(ScanStrategy.SKIP);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // 应该在合理时间内完成（100个文件夹 < 1秒）
            expect(duration).toBeLessThan(1000);
        });
    });

    describe("错误恢复测试", () => {
        it("应该在部分失败时继续处理其他文件夹", async () => {
            const folders = [
                { path: "/test/success1", shouldFail: false },
                { path: "/test/fail", shouldFail: true },
                { path: "/test/success2", shouldFail: false },
            ];

            // 设置 mock 行为
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockImplementation((folderPath) => {
                const folder = folders.find((f) => f.path === folderPath);
                if (folder?.shouldFail) {
                    return Promise.reject(new Error("配置读取失败"));
                }
                return Promise.resolve({
                    version: "1.0",
                    lastModified: Date.now(),
                    photoList: [],
                });
            });

            mockFs.existsSync.mockReturnValue(true);

            // 测试所有文件夹，确保部分失败不影响其他文件夹
            for (const folder of folders) {
                try {
                    const result = await decideScanStrategy(folder.path, mockLogger);
                    if (folder.shouldFail) {
                        expect(result.strategy).toBe(ScanStrategy.FULL);
                    } else {
                        expect(result.strategy).toBe(ScanStrategy.SKIP);
                    }
                } catch (error) {
                    // 如果文件夹应该失败，确保错误被正确处理
                    if (folder.shouldFail) {
                        expect(error).toBeInstanceOf(Error);
                    } else {
                        throw error; // 不应该失败
                    }
                }
            }
        });
    });
});
