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
// import { scanPhotos } from "../scan-photos";
import { decideScanStrategy } from "../scan-strategy";
import { restoreCachedFiles } from "../scan-helpers";
import { ScanStrategy } from "../folder-cache-manager";
import type { PhotasaLogger } from "@common/logger";
// import { Subscriber } from "rxjs";

// Mock external dependencies
vi.mock("fs-extra");
vi.mock("../config/config-storage");
vi.mock("../folder-cache-manager");
vi.mock("@shared/path-util");

const mockFs = fs as any;
const mockLogger: PhotasaLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
} as any;

describe("scan-integration-fix", () => {
    let tempDir: string;
    let testFolder: string;
    let scannedFolder: string;
    let newFolder: string;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `picasa-integration-test-${Date.now()}`);
        testFolder = path.join(tempDir, "test-root");
        scannedFolder = path.join(testFolder, "scanned-folder");
        newFolder = path.join(testFolder, "new-folder");

        await fs.ensureDir(testFolder);
        await fs.ensureDir(scannedFolder);
        await fs.ensureDir(newFolder);

        vi.clearAllMocks();
    });

    afterEach(async () => {
        await fs.remove(tempDir);
    });

    describe("完整扫描流程测试", () => {
        it("应该跳过已扫描的文件夹并扫描新文件夹", async () => {
            // 设置已扫描的文件夹
            const scannedConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: [
                    { path: "photo1.jpg", thumbnail: "thumb1.jpg", isVideo: false },
                    { path: "photo2.jpg", thumbnail: "thumb2.jpg", isVideo: false },
                ],
            };
            await fs.writeFile(
                path.join(scannedFolder, ".photasa.json"),
                JSON.stringify(scannedConfig, null, 2),
            );

            // 设置新文件夹（没有配置文件）
            await fs.writeFile(path.join(newFolder, "photo3.jpg"), "fake image data");

            // Mock 外部依赖
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockImplementation((folderPath) => {
                if (folderPath === scannedFolder) {
                    return Promise.resolve(scannedConfig);
                }
                return Promise.reject(new Error("配置文件不存在"));
            });

            const { computeFolderHash, getCacheInfo } = await import(
                "@main/scan/folder-cache-manager"
            );
            vi.mocked(computeFolderHash).mockResolvedValue("test-hash");
            vi.mocked(getCacheInfo).mockResolvedValue(null);

            const { buildThumbnailPath } = await import("@shared/path-util");
            vi.mocked(buildThumbnailPath).mockImplementation((filePath) =>
                filePath.replace(/\.[^/.]+$/, ".png"),
            );

            mockFs.existsSync.mockReturnValue(true);
            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(scannedConfig));

            // 测试扫描策略决策
            const scannedDecision = await decideScanStrategy(scannedFolder, mockLogger);
            expect(scannedDecision.strategy).toBe(ScanStrategy.SKIP);
            expect(scannedDecision.reason).toBe("配置文件存在且有效，无需重新扫描");

            const newDecision = await decideScanStrategy(newFolder, mockLogger);
            expect(newDecision.strategy).toBe(ScanStrategy.FULL);
            expect(newDecision.reason).toBe("配置文件不存在");

            // 测试文件恢复功能
            const mockSubscriber = {
                next: vi.fn(),
                error: vi.fn(),
                complete: vi.fn(),
            } as any;

            await restoreCachedFiles(scannedFolder, mockSubscriber, mockLogger);

            expect(mockSubscriber.next).toHaveBeenCalledTimes(2);
            expect(mockSubscriber.complete).toHaveBeenCalled();

            // 验证恢复的文件路径正确
            const firstCall = mockSubscriber.next.mock.calls[0][0];
            expect(firstCall.path).toBe(path.join(scannedFolder, "photo1.jpg"));
            expect(firstCall.thumbnail).toBe("thumb1.jpg");
        });

        it("应该处理混合场景：部分文件夹已扫描，部分需要扫描", async () => {
            // 创建多个子文件夹
            const folders = [
                { path: path.join(testFolder, "scanned1"), hasConfig: true },
                { path: path.join(testFolder, "scanned2"), hasConfig: true },
                { path: path.join(testFolder, "new1"), hasConfig: false },
                { path: path.join(testFolder, "new2"), hasConfig: false },
            ];

            // 设置已扫描的文件夹
            for (const folder of folders.filter((f) => f.hasConfig)) {
                await fs.ensureDir(folder.path);
                const config = {
                    version: "1.0",
                    photoList: [{ path: "photo.jpg", thumbnail: "thumb.jpg", isVideo: false }],
                };
                await fs.writeFile(
                    path.join(folder.path, ".photasa.json"),
                    JSON.stringify(config, null, 2),
                );
            }

            // 设置新文件夹
            for (const folder of folders.filter((f) => !f.hasConfig)) {
                await fs.ensureDir(folder.path);
                await fs.writeFile(path.join(folder.path, "photo.jpg"), "fake image data");
            }

            // Mock 外部依赖
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockImplementation((folderPath) => {
                const folder = folders.find((f) => f.path === folderPath);
                if (folder?.hasConfig) {
                    return Promise.resolve({
                        version: "1.0",
                        lastModified: Date.now(),
                        photoList: [{ path: "photo.jpg", thumbnail: "thumb.jpg", isVideo: false }],
                    });
                }
                return Promise.reject(new Error("配置文件不存在"));
            });

            const { computeFolderHash, getCacheInfo } = await import(
                "@main/scan/folder-cache-manager"
            );
            vi.mocked(computeFolderHash).mockResolvedValue("test-hash");
            vi.mocked(getCacheInfo).mockResolvedValue(null);

            // 测试每个文件夹的决策
            for (const folder of folders) {
                const decision = await decideScanStrategy(folder.path, mockLogger);

                if (folder.hasConfig) {
                    expect(decision.strategy).toBe(ScanStrategy.SKIP);
                    expect(decision.reason).toBe("配置文件存在且有效，无需重新扫描");
                } else {
                    expect(decision.strategy).toBe(ScanStrategy.FULL);
                    expect(decision.reason).toBe("配置文件不存在");
                }
            }
        });

        it("应该正确处理损坏的配置文件", async () => {
            // 创建损坏的配置文件
            const corruptedConfigPath = path.join(scannedFolder, ".photasa.json");
            await fs.writeFile(corruptedConfigPath, "invalid json content");

            // Mock 外部依赖
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockRejectedValue(new Error("JSON 解析失败"));

            mockFs.existsSync.mockReturnValue(true);

            const decision = await decideScanStrategy(scannedFolder, mockLogger);

            expect(decision.strategy).toBe(ScanStrategy.FULL);
            expect(decision.reason).toBe("配置文件读取失败");
        });

        it("应该正确处理权限问题", async () => {
            // Mock 权限错误
            mockFs.existsSync.mockImplementation(() => {
                throw new Error("权限被拒绝");
            });

            const decision = await decideScanStrategy(scannedFolder, mockLogger);

            expect(decision.strategy).toBe(ScanStrategy.FULL);
            expect(decision.reason).toBe("决策失败，使用安全的完整扫描");
        });
    });

    describe("性能集成测试", () => {
        it("应该快速处理大量已扫描的文件夹", async () => {
            // 创建大量已扫描的文件夹
            const scannedFolders = Array.from({ length: 100 }, (_, i) =>
                path.join(testFolder, `scanned${i}`),
            );

            for (const folder of scannedFolders) {
                await fs.ensureDir(folder);
                const config = {
                    version: "1.0",
                    photoList: Array.from({ length: 10 }, (_, j) => ({
                        path: `photo${j}.jpg`,
                        thumbnail: `thumb${j}.jpg`,
                        isVideo: false,
                    })),
                };
                await fs.writeFile(
                    path.join(folder, ".photasa.json"),
                    JSON.stringify(config, null, 2),
                );
            }

            // Mock 外部依赖
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockResolvedValue({
                version: "1.0",
                lastModified: Date.now(),
                photoList: Array.from({ length: 10 }, (_, j) => ({
                    path: `photo${j}.jpg`,
                    thumbnail: `thumb${j}.jpg`,
                    isVideo: false,
                })),
            });

            mockFs.existsSync.mockReturnValue(true);

            const startTime = Date.now();

            // 并发测试所有文件夹
            const decisions = await Promise.all(
                scannedFolders.map((folder) => decideScanStrategy(folder, mockLogger)),
            );

            const endTime = Date.now();

            // 验证所有文件夹都被跳过
            expect(decisions.every((d) => d.strategy === ScanStrategy.SKIP)).toBe(true);
            expect(endTime - startTime).toBeLessThan(2000); // 应该在2秒内完成
        });

        it("应该快速恢复大量文件的配置", async () => {
            // 创建包含大量文件的配置
            const largeConfig = {
                version: "1.0",
                photoList: Array.from({ length: 1000 }, (_, i) => ({
                    path: `photo${i}.jpg`,
                    thumbnail: `thumb${i}.jpg`,
                    isVideo: false,
                })),
            };

            const configPath = path.join(scannedFolder, ".photasa.json");
            await fs.writeFile(configPath, JSON.stringify(largeConfig, null, 2));

            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(largeConfig));

            const { buildThumbnailPath } = await import("@shared/path-util");
            vi.mocked(buildThumbnailPath).mockImplementation((filePath) =>
                filePath.replace(/\.[^/.]+$/, ".png"),
            );

            const mockSubscriber = {
                next: vi.fn(),
                error: vi.fn(),
                complete: vi.fn(),
            } as any;

            const startTime = Date.now();
            await restoreCachedFiles(scannedFolder, mockSubscriber, mockLogger);
            const endTime = Date.now();

            expect(mockSubscriber.next).toHaveBeenCalledTimes(1000);
            expect(mockSubscriber.complete).toHaveBeenCalled();
            expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
        });
    });

    describe("错误恢复测试", () => {
        it("应该在部分失败时继续处理其他文件夹", async () => {
            const folders = [
                { path: path.join(testFolder, "good1"), shouldFail: false },
                { path: path.join(testFolder, "bad"), shouldFail: true },
                { path: path.join(testFolder, "good2"), shouldFail: false },
            ];

            // 设置文件夹
            for (const folder of folders) {
                await fs.ensureDir(folder.path);
                if (!folder.shouldFail) {
                    const config = {
                        version: "1.0",
                        photoList: [{ path: "photo.jpg", thumbnail: "thumb.jpg", isVideo: false }],
                    };
                    await fs.writeFile(
                        path.join(folder.path, ".photasa.json"),
                        JSON.stringify(config, null, 2),
                    );
                }
            }

            // Mock 外部依赖
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockImplementation((folderPath) => {
                const folder = folders.find((f) => f.path === folderPath);
                if (folder?.shouldFail) {
                    return Promise.reject(new Error("模拟错误"));
                }
                return Promise.resolve({
                    version: "1.0",
                    lastModified: Date.now(),
                    photoList: [{ path: "photo.jpg", thumbnail: "thumb.jpg", isVideo: false }],
                });
            });

            mockFs.existsSync.mockReturnValue(true);

            // 测试所有文件夹
            const results = await Promise.allSettled(
                folders.map((folder) => decideScanStrategy(folder.path, mockLogger)),
            );

            // 验证结果
            expect(results[0].status).toBe("fulfilled");
            expect(results[1].status).toBe("fulfilled"); // 应该处理错误并返回 FULL 策略
            expect(results[2].status).toBe("fulfilled");

            if (results[0].status === "fulfilled") {
                expect(results[0].value.strategy).toBe(ScanStrategy.SKIP);
            }
            if (results[1].status === "fulfilled") {
                expect(results[1].value.strategy).toBe(ScanStrategy.FULL);
            }
            if (results[2].status === "fulfilled") {
                expect(results[2].value.strategy).toBe(ScanStrategy.SKIP);
            }
        });
    });
});
