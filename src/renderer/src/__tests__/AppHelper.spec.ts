/**
 * AppHelper.spec.ts
 *
 * AppHelper的单元测试 - 展示纯函数设计的可测试性
 */

import { describe, it, expect, vi } from "vitest";
import {
    decideScanStrategy,
    validateScanAction,
    getNextScanItem,
    orchestrateScan,
    executeDirectoryStrategy,
    executeFileStrategy,
    type ScanCallbacks,
} from "../AppHelper";
import type { ScanAction } from "@common/scan-types";

describe("AppHelper - Pure Functions", () => {
    // ============= 测试数据工厂 =============
    const createScanAction = (overrides: Partial<ScanAction> = {}): ScanAction => ({
        path: "/test/path",
        action: "scan",
        thumbnailSize: 150,
        ...overrides,
    });

    // ============= 纯函数测试 =============

    describe("decideScanStrategy", () => {
        it("应该为文件操作返回正确的策略", () => {
            const fileAction = createScanAction({
                path: "/test/file.jpg",
                operationType: "file",
                thumbnailSize: 200,
            });

            const decision = decideScanStrategy(fileAction);

            expect(decision.shouldProcessSubfolders).toBe(false);
            expect(decision.shouldUpdateParentFolder).toBe(true);
            expect(decision.parentFolderPath).toBe("/test/file.jpg");
        });

        it("应该为目录操作返回正确的策略", () => {
            const dirAction = createScanAction({
                path: "/test/folder",
                operationType: "directory",
            });

            const decision = decideScanStrategy(dirAction);

            expect(decision.shouldProcessSubfolders).toBe(true);
            expect(decision.shouldUpdateParentFolder).toBe(false);
        });

        it("应该为未指定操作类型默认为目录操作", () => {
            const defaultAction = createScanAction({
                path: "/test/folder",
                // operationType 未指定
            });

            const decision = decideScanStrategy(defaultAction);

            expect(decision.shouldProcessSubfolders).toBe(true);
        });
    });

    describe("validateScanAction", () => {
        it("应该验证有效的扫描动作", () => {
            const validAction = createScanAction({
                path: "/test/folder",
            });

            const result = validateScanAction(validAction);

            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it("应该拒绝空的扫描动作", () => {
            const result = validateScanAction(null);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("No scan action provided");
        });

        it("应该拒绝缺少路径的扫描动作", () => {
            const invalidAction = {
                action: "scan",
                // path 缺失
            } as ScanAction;

            const result = validateScanAction(invalidAction);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Scan action missing path");
        });
    });

    describe("getNextScanItem", () => {
        it("应该返回队列中的第一个项目", () => {
            const queue = [{ path: "/test/folder1" }, { path: "/test/folder2" }];

            const nextItem = getNextScanItem(queue);

            expect(nextItem).toEqual({ path: "/test/folder1" });
        });

        it("应该在空队列时返回null", () => {
            const emptyQueue: any[] = [];

            const nextItem = getNextScanItem(emptyQueue);

            expect(nextItem).toBeNull();
        });
    });

    // ============= 异步函数测试 =============

    describe("executeFileStrategy", () => {
        it("应该成功执行文件策略", async () => {
            const mockCallbacks: ScanCallbacks = {
                logInfo: vi.fn(),
                logDebug: vi.fn(),
                logError: vi.fn(),
                updateProcessingStatus: vi.fn(),
                clearProcessingStatus: vi.fn(),
                updateFolderTree: vi.fn(),
                completeScanPath: vi.fn(),
                scanSubfolders: vi.fn(),
                addScanFolderToQueue: vi.fn(),
                performScanTask: vi.fn(),
                resetPhotasaConfig: vi.fn(),
                extractParentDir: vi.fn().mockReturnValue("/test"),
                scheduleNextScan: vi.fn(),
            };

            const fileAction = createScanAction({
                path: "/test/file.jpg",
                operationType: "file",
            });

            const result = await executeFileStrategy(fileAction, mockCallbacks);

            expect(result.shouldUpdateParentFolder).toBe(true);
            expect(result.parentFolderPath).toBe("/test");
            expect(mockCallbacks.extractParentDir).toHaveBeenCalledWith("/test/file.jpg");
            expect(mockCallbacks.updateFolderTree).toHaveBeenCalledWith("/test");
        });

        it("应该处理父目录提取失败的情况", async () => {
            const mockCallbacks: ScanCallbacks = {
                logInfo: vi.fn(),
                logDebug: vi.fn(),
                logError: vi.fn(),
                updateProcessingStatus: vi.fn(),
                clearProcessingStatus: vi.fn(),
                updateFolderTree: vi.fn(),
                completeScanPath: vi.fn(),
                scanSubfolders: vi.fn(),
                addScanFolderToQueue: vi.fn(),
                performScanTask: vi.fn(),
                resetPhotasaConfig: vi.fn(),
                extractParentDir: vi.fn().mockReturnValue(null), // 返回null
                scheduleNextScan: vi.fn(),
            };

            const fileAction = createScanAction({
                path: "/test/file.jpg",
                operationType: "file",
            });

            const result = await executeFileStrategy(fileAction, mockCallbacks);

            expect(result.shouldUpdateParentFolder).toBe(false);
            expect(mockCallbacks.updateFolderTree).not.toHaveBeenCalled();
        });
    });

    describe("executeDirectoryStrategy", () => {
        it("应该成功执行目录策略", async () => {
            const mockSubfolders = ["/test/sub1", "/test/sub2"];
            const mockCallbacks: ScanCallbacks = {
                logInfo: vi.fn(),
                logDebug: vi.fn(),
                logError: vi.fn(),
                updateProcessingStatus: vi.fn(),
                clearProcessingStatus: vi.fn(),
                updateFolderTree: vi.fn(),
                completeScanPath: vi.fn(),
                scanSubfolders: vi.fn().mockResolvedValue(mockSubfolders),
                addScanFolderToQueue: vi.fn(),
                performScanTask: vi.fn(),
                resetPhotasaConfig: vi.fn(),
                extractParentDir: vi.fn(),
                scheduleNextScan: vi.fn(),
            };

            const dirAction = createScanAction({
                path: "/test/folder",
                operationType: "directory",
            });

            const result = await executeDirectoryStrategy(dirAction, mockCallbacks);

            expect(result.shouldProcessSubfolders).toBe(true);
            expect(result.subfolders).toEqual(mockSubfolders);
            expect(mockCallbacks.scanSubfolders).toHaveBeenCalledWith("/test/folder");
            expect(mockCallbacks.addScanFolderToQueue).toHaveBeenCalledTimes(2);
        });

        it("应该处理子文件夹扫描失败的情况", async () => {
            const mockError = new Error("Scan failed");
            const mockCallbacks: ScanCallbacks = {
                logInfo: vi.fn(),
                logDebug: vi.fn(),
                logError: vi.fn(),
                updateProcessingStatus: vi.fn(),
                clearProcessingStatus: vi.fn(),
                updateFolderTree: vi.fn(),
                completeScanPath: vi.fn(),
                scanSubfolders: vi.fn().mockRejectedValue(mockError),
                addScanFolderToQueue: vi.fn(),
                performScanTask: vi.fn(),
                resetPhotasaConfig: vi.fn(),
                extractParentDir: vi.fn(),
                scheduleNextScan: vi.fn(),
            };

            const dirAction = createScanAction({
                path: "/test/folder",
                operationType: "directory",
            });

            const result = await executeDirectoryStrategy(dirAction, mockCallbacks);

            expect(result.shouldProcessSubfolders).toBe(false);
            expect(mockCallbacks.logError).toHaveBeenCalledWith(
                "[扫描编排] 扫描子文件夹失败: /test/folder",
                mockError,
            );
            expect(mockCallbacks.addScanFolderToQueue).not.toHaveBeenCalled();
        });
    });

    // ============= 集成测试 =============

    describe("orchestrateScan", () => {
        it("应该完整执行扫描编排流程", async () => {
            const mockCallbacks: ScanCallbacks = {
                logInfo: vi.fn(),
                logDebug: vi.fn(),
                logError: vi.fn(),
                updateProcessingStatus: vi.fn(),
                clearProcessingStatus: vi.fn(),
                updateFolderTree: vi.fn(),
                completeScanPath: vi.fn(),
                scanSubfolders: vi.fn().mockResolvedValue(["/test/sub"]),
                addScanFolderToQueue: vi.fn(),
                performScanTask: vi.fn().mockResolvedValue({ success: true }),
                resetPhotasaConfig: vi.fn(),
                extractParentDir: vi.fn(),
                scheduleNextScan: vi.fn(),
            };

            const scanQueue: ScanAction[] = [
                {
                    path: "/test/folder",
                    action: "scan",
                    operationType: "directory",
                    thumbnailSize: 150,
                },
            ];

            const result = await orchestrateScan(scanQueue, mockCallbacks);

            expect(result.processed).toBe(true);
            expect(result.shouldScheduleNext).toBe(true);
            expect(result.error).toBeUndefined();

            // 验证回调被正确调用
            expect(mockCallbacks.updateProcessingStatus).toHaveBeenCalledWith(
                "正在扫描: /test/folder",
            );
            expect(mockCallbacks.scanSubfolders).toHaveBeenCalledWith("/test/folder");
            expect(mockCallbacks.performScanTask).toHaveBeenCalled();
            expect(mockCallbacks.completeScanPath).toHaveBeenCalledWith("/test/folder");
        });

        it("应该处理空队列", async () => {
            const mockCallbacks = {} as ScanCallbacks;
            mockCallbacks.logDebug = vi.fn();
            mockCallbacks.clearProcessingStatus = vi.fn();

            const emptyQueue: ScanAction[] = [];

            const result = await orchestrateScan(emptyQueue, mockCallbacks);

            expect(result.processed).toBe(false);
            expect(result.shouldScheduleNext).toBe(false);
            expect(mockCallbacks.logDebug).toHaveBeenCalledWith("[扫描编排] 队列为空，无需处理");
        });

        it("应该处理重扫描动作", async () => {
            const mockCallbacks: ScanCallbacks = {
                logInfo: vi.fn(),
                logDebug: vi.fn(),
                logError: vi.fn(),
                updateProcessingStatus: vi.fn(),
                clearProcessingStatus: vi.fn(),
                updateFolderTree: vi.fn(),
                completeScanPath: vi.fn(),
                scanSubfolders: vi.fn().mockResolvedValue([]),
                addScanFolderToQueue: vi.fn(),
                performScanTask: vi.fn().mockResolvedValue({}),
                resetPhotasaConfig: vi.fn(),
                extractParentDir: vi.fn(),
                scheduleNextScan: vi.fn(),
            };

            const rescanQueue: ScanAction[] = [
                {
                    path: "/test/folder",
                    action: "rescan",
                    operationType: "directory",
                    thumbnailSize: 150,
                },
            ];

            await orchestrateScan(rescanQueue, mockCallbacks);

            expect(mockCallbacks.resetPhotasaConfig).toHaveBeenCalledWith("/test/folder");
        });
    });
});
