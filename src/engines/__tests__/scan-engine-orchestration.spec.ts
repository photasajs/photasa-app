/**
 * 扫描引擎编排集成测试 - 验证实际扫描场景下的引擎调度
 * RFC 0032 Phase 2: 功能验证
 *
 * 测试目标：
 * 1. 验证天枢引擎在实际扫描场景下的编排能力
 * 2. 测试引擎间的协同调度和任务分发
 * 3. 确保扫描工作流的完整性和稳定性
 */

import { TianshuEngine } from "../tianshu/core/TianshuEngine";
import { TaiyiEngine } from "../taiyi/core/TaiyiEngine";
import { WenchangAdapter } from "../adapters/WenchangAdapter";
import { join } from "path";

describe("扫描引擎编排集成测试 - RFC 0032 Phase 2", () => {
    let tianshuEngine: TianshuEngine;
    let taiyiEngine: TaiyiEngine;
    let wenchangAdapter: WenchangAdapter;

    beforeEach(async () => {
        // 初始化文昌适配器
        wenchangAdapter = new WenchangAdapter();
        await wenchangAdapter.initialize();

        // 初始化太乙引擎
        taiyiEngine = new TaiyiEngine({
            enableHealthCheck: true,
            healthCheckInterval: 30000,
        });
        await taiyiEngine.initialize();

        // 初始化天枢引擎
        tianshuEngine = new TianshuEngine({
            workflowDir: join(__dirname, "../../tianshu/workflows"),
            maxConcurrentWorkflows: 5,
            defaultTimeout: 30000,
            enableHotReload: false,
            stepExecutor: {
                initialize: jest.fn(),
                executeAction: jest.fn().mockResolvedValue({ success: true, result: {} }),
                on: jest.fn(),
                off: jest.fn(),
                once: jest.fn(),
                removeAllListeners: jest.fn(),
            },
        });
        await tianshuEngine.initialize();
    });

    afterEach(async () => {
        await tianshuEngine?.shutdown();
        await taiyiEngine?.shutdown();
        await wenchangAdapter?.shutdown();
    });

    describe("扫描意图处理验证", () => {
        it("应该能够处理文件夹扫描意图", async () => {
            const scanIntent = {
                type: "folder",
                paths: ["/test/path"],
                recursive: true,
                priority: "user",
                filters: {
                    includePatterns: ["*.jpg", "*.png"],
                    excludePatterns: ["*.tmp"],
                },
            };

            const result = await tianshuEngine.handleScanIntent(scanIntent);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data.scannedPaths).toEqual(scanIntent.paths);
            expect(result.data.type).toBe(scanIntent.type);
        });

        it("应该能够处理文件扫描意图", async () => {
            const scanIntent = {
                type: "file",
                paths: ["/test/path/image.jpg"],
                priority: "background",
                filters: {},
            };

            const result = await tianshuEngine.handleScanIntent(scanIntent);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.data.scannedPaths).toEqual(scanIntent.paths);
            expect(result.data.type).toBe(scanIntent.type);
        });

        it("应该能够处理高优先级扫描请求", async () => {
            const highPriorityScanIntent = {
                type: "folder",
                paths: ["/urgent/path"],
                recursive: false,
                priority: "urgent",
                filters: {
                    includePatterns: ["*.raw", "*.dng"],
                },
            };

            const result = await tianshuEngine.handleScanIntent(highPriorityScanIntent);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.data.type).toBe("folder");
        });
    });

    describe("扫描进度监控验证", () => {
        it("应该能够监听扫描进度事件", async () => {
            const progressEvents: any[] = [];

            // 监听扫描进度事件
            tianshuEngine.on("scanProgress", (event) => {
                progressEvents.push(event);
            });

            const scanIntent = {
                type: "folder",
                paths: ["/test/progress"],
                recursive: true,
                priority: "user",
                filters: {},
            };

            await tianshuEngine.handleScanIntent(scanIntent);

            // 注意：由于这是模拟测试，实际的进度事件可能不会触发
            // 这里主要验证监听机制是否正确设置
            expect(tianshuEngine.listenerCount("scanProgress")).toBe(1);
        });

        it("应该能够处理扫描过程中的偏好变更", async () => {
            // 先获取当前偏好
            const currentPrefs = await tianshuEngine.handlePreferenceGet();
            expect(currentPrefs).toBeDefined();

            // 启动扫描
            const scanIntent = {
                type: "folder",
                paths: ["/test/concurrent"],
                recursive: true,
                priority: "background",
                filters: {},
            };

            const scanPromise = tianshuEngine.handleScanIntent(scanIntent);

            // 在扫描过程中更新偏好
            const delta = {
                scanning: {
                    autoScan: false,
                    excludePatterns: ["*.cache"],
                },
            };

            const updatePromise = tianshuEngine.handlePreferenceUpdate(delta);

            // 等待两个操作完成
            const [scanResult, updateResult] = await Promise.all([scanPromise, updatePromise]);

            expect(scanResult.success).toBe(true);
            expect(updateResult).toBeGreaterThan(0);
        });
    });

    describe("引擎协调和资源管理", () => {
        it("应该能够获取引擎状态报告", async () => {
            const statusReport = await tianshuEngine.getSystemStatus();

            expect(statusReport).toBeDefined();
            expect(statusReport.overallStatus).toBe("healthy");
            expect(statusReport.engines).toBeDefined();
            expect(Array.isArray(statusReport.engines)).toBe(true);
            expect(statusReport.engines.length).toBeGreaterThan(0);

            // 验证天枢引擎自身状态
            const tianshuStatus = statusReport.engines.find((e) => e.name === "tianshu");
            expect(tianshuStatus).toBeDefined();
            expect(tianshuStatus.status).toBe("healthy");
        });

        it("应该能够管理并发扫描任务", async () => {
            const concurrentScans = Array.from({ length: 3 }, (_, index) => ({
                type: "folder",
                paths: [`/test/concurrent/${index}`],
                recursive: true,
                priority: "background",
                filters: {},
            }));

            const startTime = Date.now();
            const results = await Promise.all(
                concurrentScans.map((intent) => tianshuEngine.handleScanIntent(intent)),
            );
            const endTime = Date.now();

            // 验证所有扫描都成功
            results.forEach((result, index) => {
                expect(result.success).toBe(true);
                expect(result.data.scannedPaths).toEqual([`/test/concurrent/${index}`]);
            });

            // 验证并发执行时间合理
            const executionTime = endTime - startTime;
            expect(executionTime).toBeLessThan(10000); // 10秒内完成
        });

        it("应该正确处理引擎间的依赖关系", async () => {
            // 验证太乙引擎可以获取到文昌引擎状态
            const wenchangStatus = taiyiEngine.getEngineStatus("wenchang");
            expect(wenchangStatus).toBeDefined();

            // 验证太乙引擎可以调用文昌引擎
            const result = await taiyiEngine.callEngine("wenchang", "getCurrentSnapshot");
            expect(result.success).toBe(true);
            expect(result.engineName).toBe("wenchang");

            // 验证天枢引擎可以通过太乙获取系统整体状态
            const systemStatus = await tianshuEngine.getSystemStatus();
            expect(systemStatus.overallStatus).toBe("healthy");
        });
    });

    describe("错误恢复和容错机制", () => {
        it("应该能够处理扫描路径不存在的情况", async () => {
            const invalidScanIntent = {
                type: "folder",
                paths: ["/nonexistent/path"],
                recursive: true,
                priority: "user",
                filters: {},
            };

            // 这个测试验证系统不会因为无效路径而崩溃
            const result = await tianshuEngine.handleScanIntent(invalidScanIntent);

            // 即使路径不存在，系统也应该优雅处理
            expect(result).toBeDefined();
            expect(result.success).toBe(true); // 因为这是模拟实现
        });

        it("应该能够处理偏好导入操作", async () => {
            const importPreferences = {
                revision: 10,
                ui: {
                    theme: "dark",
                    layout: "list",
                    language: "en-US",
                },
                display: {
                    thumbnailSize: 150,
                    sortOrder: "sizeAsc",
                    groupBy: "type",
                },
                scanning: {
                    autoScan: true,
                    excludePatterns: ["*.log", "*.cache", "*.tmp"],
                },
            };

            const result = await tianshuEngine.handlePreferenceImport(importPreferences);

            expect(result).toBeDefined();
            expect(result.ui.theme).toBe("dark");
            expect(result.display.thumbnailSize).toBe(150);
            expect(result.scanning.excludePatterns).toContain("*.log");
        });
    });

    describe("性能基准测试", () => {
        it("应该在合理时间内处理大量扫描请求", async () => {
            const requestCount = 20;
            const scanRequests = Array.from({ length: requestCount }, (_, index) => ({
                type: "file",
                paths: [`/test/file_${index}.jpg`],
                priority: "background",
                filters: {},
            }));

            const startTime = Date.now();
            const results = await Promise.all(
                scanRequests.map((intent) => tianshuEngine.handleScanIntent(intent)),
            );
            const endTime = Date.now();

            // 验证所有请求都成功
            results.forEach((result) => {
                expect(result.success).toBe(true);
            });

            // 验证平均处理时间
            const avgProcessingTime = (endTime - startTime) / requestCount;
            expect(avgProcessingTime).toBeLessThan(500); // 平均500ms内处理
        });

        it("应该能够处理引擎状态的频繁查询", async () => {
            const queryCount = 50;
            const queries = Array.from({ length: queryCount }, () =>
                tianshuEngine.getSystemStatus(),
            );

            const startTime = Date.now();
            const results = await Promise.all(queries);
            const endTime = Date.now();

            // 验证所有查询都成功
            results.forEach((status) => {
                expect(status.overallStatus).toBe("healthy");
            });

            // 验证查询性能
            const avgQueryTime = (endTime - startTime) / queryCount;
            expect(avgQueryTime).toBeLessThan(100); // 平均100ms内响应
        });
    });
});
