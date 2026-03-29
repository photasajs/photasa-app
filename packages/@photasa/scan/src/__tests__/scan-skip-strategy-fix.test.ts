/**
 * 测试 skip 策略修复
 * 验证当使用 skip 策略时，订阅器能正确完成并且子目录能被扫描
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { scanPhotos } from "../scan-photos";
import { restoreCachedFiles } from "../scan-helpers";
import * as scanStrategy from "../strategy/scan-strategy";
import { ScanStrategy } from "../cache/folder-cache-manager";
import fs from "fs-extra";
import { loggers } from "@photasa/common";

// Mock 依赖
vi.mock("fs-extra");
vi.mock("../strategy/scan-strategy");
vi.mock("../../thumbnail/thumbnail-worker?nodeWorker", () => ({
    default: class {
        on = vi.fn();
        postMessage = vi.fn();
        terminate = vi.fn();
    },
}));
vi.mock("../cache/incremental-cache", () => ({
    IncrementalCacheManager: class {
        initialize = vi.fn().mockResolvedValue({});
        markScanComplete = vi.fn().mockResolvedValue(undefined);
        isFileProcessed = vi.fn().mockReturnValue(false);
        setPendingFiles = vi.fn();
        recordFileProcessed = vi.fn().mockResolvedValue(undefined);
    },
}));

describe("Skip Strategy Fix", () => {
    const mockLogger = loggers.scan;
    const testPath = "/test/photos";

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock fs 操作
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.statSync).mockReturnValue({
            isDirectory: () => true,
            isFile: () => false,
        } as any);
        (vi.mocked(fs.pathExists) as any).mockResolvedValue(true);
        (vi.mocked(fs.readFile) as any).mockResolvedValue(
            JSON.stringify({
                photoList: [
                    { path: "photo1.jpg", isImage: true, thumbnail: "/thumb/photo1.jpg" },
                    { path: "photo2.jpg", isImage: true, thumbnail: "/thumb/photo2.jpg" },
                ],
            }),
        );
        // Mock readdir - 根据路径返回不同的结果，避免无限递归
        vi.mocked(fs.readdir).mockImplementation(async (dirPath) => {
            // 只在顶层目录返回子目录，子目录返回空数组
            if (dirPath === testPath) {
                return [
                    { name: "subdir1", isDirectory: () => true },
                    { name: "subdir2", isDirectory: () => true },
                    { name: "photo.jpg", isDirectory: () => false },
                ] as any;
            }
            // 子目录返回空，避免无限递归
            return [] as any;
        });
    });

    it("应该在 skip 策略后正确调用 subscriber.complete()", async () => {
        // 设置 skip 策略
        vi.mocked(scanStrategy.decideScanStrategy).mockResolvedValue({
            strategy: ScanStrategy.SKIP,
            reason: "No changes detected",
        });

        const scanAction = {
            path: testPath,
            operationType: "directory" as const,
            action: "scan" as const,
            thumbnailSize: 200,
        };

        // 收集扫描结果
        const results: any[] = [];
        let completeCalled = false;
        let errorOccurred = false;

        // 创建 Promise 来等待扫描完成
        const scanPromise = new Promise<void>((resolve, reject) => {
            scanPhotos(scanAction, mockLogger).subscribe({
                next: (photo) => {
                    results.push(photo);
                },
                error: (error) => {
                    errorOccurred = true;
                    reject(error);
                },
                complete: () => {
                    completeCalled = true;
                    resolve();
                },
            });
        });

        // 等待扫描完成
        await scanPromise;

        // 验证结果
        expect(completeCalled).toBe(true);
        expect(errorOccurred).toBe(false);
        expect(results.length).toBeGreaterThanOrEqual(2); // 至少应该恢复2个缓存文件
    });

    it("应该在 skip 策略下扫描子目录", async () => {
        // 设置 skip 策略
        vi.mocked(scanStrategy.decideScanStrategy).mockResolvedValue({
            strategy: ScanStrategy.SKIP,
            reason: "No changes detected",
        });

        const scanAction = {
            path: testPath,
            operationType: "directory" as const,
            action: "scan" as const,
            thumbnailSize: 200,
        };

        // 记录扫描的路径
        const scannedPaths = new Set<string>();

        // Mock decideScanStrategy 来记录被扫描的路径
        vi.mocked(scanStrategy.decideScanStrategy).mockImplementation(async (folderPath) => {
            scannedPaths.add(folderPath);
            // 主目录使用 skip，子目录使用 full
            if (folderPath === testPath) {
                return { strategy: ScanStrategy.SKIP, reason: "No changes" };
            } else {
                return { strategy: ScanStrategy.FULL, reason: "New directory" };
            }
        });

        // 执行扫描
        const scanPromise = new Promise<void>((resolve, reject) => {
            scanPhotos(scanAction, mockLogger).subscribe({
                next: () => {},
                error: reject,
                complete: resolve,
            });
        });

        await scanPromise;

        // 验证子目录被扫描
        expect(scannedPaths.has(testPath)).toBe(true);
        // 因为递归调用 scanPhotos，子目录的策略决策也会被调用
        expect(scannedPaths.size).toBeGreaterThan(1);
    });

    it("restoreCachedFiles 不应该调用 subscriber.complete()", async () => {
        const mockSubscriber = {
            next: vi.fn(),
            error: vi.fn(),
            complete: vi.fn(),
        };

        // 设置有效的缓存文件
        (vi.mocked(fs.pathExists) as any).mockResolvedValue(true);
        (vi.mocked(fs.readFile) as any).mockResolvedValue(
            JSON.stringify({
                photoList: [{ path: "photo1.jpg", isImage: true }],
            }),
        );

        await restoreCachedFiles(testPath, mockSubscriber as any, mockLogger);

        // 验证 complete 没有被调用
        expect(mockSubscriber.complete).not.toHaveBeenCalled();
        expect(mockSubscriber.next).toHaveBeenCalledTimes(1);
    });

    it("即使缓存文件不存在，restoreCachedFiles 也不应调用 complete", async () => {
        const mockSubscriber = {
            next: vi.fn(),
            error: vi.fn(),
            complete: vi.fn(),
        };

        // 设置缓存文件不存在
        (vi.mocked(fs.pathExists) as any).mockResolvedValue(false);

        await restoreCachedFiles(testPath, mockSubscriber as any, mockLogger);

        // 验证 complete 没有被调用
        expect(mockSubscriber.complete).not.toHaveBeenCalled();
        expect(mockSubscriber.next).not.toHaveBeenCalled();
    });

    it("应该正确处理 subscriber 上下文绑定", async () => {
        // 模拟一个有上下文的订阅器
        const contextualSubscriber = {
            name: "test-subscriber",
            next: vi.fn(function (this: any, _value: any) {
                // 验证 this 上下文
                expect(this.name).toBe("test-subscriber");
            }),
            error: vi.fn(),
            complete: vi.fn(),
        };

        // 设置有效的缓存文件
        (vi.mocked(fs.pathExists) as any).mockResolvedValue(true);
        (vi.mocked(fs.readFile) as any).mockResolvedValue(
            JSON.stringify({
                photoList: [{ path: "photo1.jpg", isImage: true }],
            }),
        );

        await restoreCachedFiles(testPath, contextualSubscriber as any, mockLogger);

        // 验证 next 被调用且上下文正确
        expect(contextualSubscriber.next).toHaveBeenCalledTimes(1);
    });
});
