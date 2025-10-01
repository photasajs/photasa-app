/**
 * 千里眼扫描引擎集成测试
 * 测试千里眼引擎与太乙引擎的集成
 */

import { QianliyanEngine } from "../qianliyan/core/QianliyanEngine";
import { TaiyiEngine } from "../taiyi/core/TaiyiEngine";
import { join } from "path";
import { describe, beforeEach, afterEach, it, expect } from "@jest/globals";

describe("千里眼扫描引擎集成测试", () => {
    let qianliyanEngine: QianliyanEngine;
    let taiyiEngine: TaiyiEngine;

    beforeEach(async () => {
        // 初始化千里眼引擎
        qianliyanEngine = new QianliyanEngine({
            maxConcurrentScans: 3,
            scanTimeout: 30000,
            enableProgressReporting: true,
        });

        // 初始化太乙引擎
        taiyiEngine = new TaiyiEngine({
            adapterArgs: [],
            enableHealthCheck: true,
            healthCheckInterval: 30000,
        });

        await qianliyanEngine.initialize();
        await taiyiEngine.initialize();
    });

    afterEach(async () => {
        await qianliyanEngine.shutdown();
        await taiyiEngine.shutdown();
    });

    describe("基本扫描功能", () => {
        it("应该能够执行基本扫描", async () => {
            const testPath = join(__dirname, "../../../test-photos");

            const result = await qianliyanEngine.scan({
                requestId: "test-001",
                paths: [testPath],
                recursive: true,
                filters: {
                    includePatterns: ["*.jpg", "*.png"],
                    excludePatterns: ["*.tmp"],
                },
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.requestId).toBe("test-001");
        });

        it("应该能够报告扫描进度", (done) => {
            const testPath = join(__dirname, "../../../test-photos");

            qianliyanEngine.on("scanProgress", (progress) => {
                expect(progress.requestId).toBe("test-002");
                expect(progress.percentage).toBeGreaterThanOrEqual(0);
                expect(progress.percentage).toBeLessThanOrEqual(100);
                done();
            });

            qianliyanEngine.scan({
                requestId: "test-002",
                paths: [testPath],
                recursive: true,
                filters: {
                    includePatterns: ["*.jpg"],
                },
            });
        });

        it("应该能够处理多个路径", async () => {
            const paths = [
                join(__dirname, "../../../test-photos"),
                join(__dirname, "../../../test-data"),
            ];

            const result = await qianliyanEngine.scan({
                requestId: "test-003",
                paths,
                recursive: true,
                filters: {
                    includePatterns: ["*.jpg", "*.png"],
                },
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.path).toContain(paths[0]);
        });
    });

    describe("太乙引擎集成", () => {
        it("应该能够通过太乙引擎调用千里眼", async () => {
            const testPath = join(__dirname, "../../../test-photos");

            const result = await taiyiEngine.callEngine("qianliyan", "scan", {
                requestId: "test-004",
                paths: [testPath],
                recursive: true,
                filters: {
                    includePatterns: ["*.jpg"],
                },
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it("应该能够处理扫描错误", async () => {
            const invalidPath = "/invalid/path/that/does/not/exist";

            const result = await taiyiEngine.callEngine("qianliyan", "scan", {
                requestId: "test-005",
                paths: [invalidPath],
                recursive: true,
            });

            expect(result).toBeDefined();
            // 应该优雅地处理错误
            expect(typeof result).toBe("object");
        });
    });

    describe("并发扫描", () => {
        it("应该能够处理多个并发扫描", async () => {
            const testPath = join(__dirname, "../../../test-photos");
            const promises = [];

            for (let i = 0; i < 3; i++) {
                promises.push(
                    qianliyanEngine.scan({
                        requestId: `concurrent-${i}`,
                        paths: [testPath],
                        recursive: true,
                        filters: {
                            includePatterns: ["*.jpg"],
                        },
                    }),
                );
            }

            const results = await Promise.all(promises);

            expect(results).toHaveLength(3);
            results.forEach((result, index) => {
                expect(result).toBeDefined();
                expect(result.requestId).toBe(`concurrent-${index}`);
            });
        });
    });

    describe("扫描状态管理", () => {
        it("应该能够获取扫描状态", () => {
            const status = qianliyanEngine.getStatus();

            expect(status).toBeDefined();
            expect(status.activeScans).toBe(0);
            expect(status.queuedScans).toBe(0);
            expect(status.totalScans).toBe(0);
        });

        it("应该能够取消扫描", async () => {
            const testPath = join(__dirname, "../../../test-photos");

            const scanPromise = qianliyanEngine.scan({
                requestId: "test-cancel",
                paths: [testPath],
                recursive: true,
                filters: {
                    includePatterns: ["*.jpg"],
                },
            });

            // 立即取消
            qianliyanEngine.cancelScan("test-cancel");

            const result = await scanPromise;
            expect(result).toBeDefined();
        });
    });

    describe("错误处理", () => {
        it("应该能够处理无效的扫描参数", async () => {
            const result = await qianliyanEngine.scan({
                requestId: "test-invalid",
                paths: [],
                recursive: true,
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(false);
        });

        it("应该能够处理超时", async () => {
            const qianliyanEngineWithShortTimeout = new QianliyanEngine({
                maxConcurrentScans: 1,
                scanTimeout: 100, // 很短的超时时间
                enableProgressReporting: true,
            });

            await qianliyanEngineWithShortTimeout.initialize();

            const testPath = join(__dirname, "../../../test-photos");

            const result = await qianliyanEngineWithShortTimeout.scan({
                requestId: "test-timeout",
                paths: [testPath],
                recursive: true,
                filters: {
                    includePatterns: ["*.jpg"],
                },
            });

            expect(result).toBeDefined();
            // 可能会因为超时而失败，这是预期的

            await qianliyanEngineWithShortTimeout.shutdown();
        });
    });
});
