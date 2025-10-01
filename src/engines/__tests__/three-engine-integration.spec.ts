/**
 * 三引擎集成测试 - 验证天枢、太乙、文昌引擎协同工作
 * RFC 0032 Phase 2: 功能验证
 *
 * 正确架构关系：
 * 1. 天枢引擎（Tianshu）- 编排引擎，处理工作流和意图调度
 * 2. 太乙引擎（Taiyi）- 协调引擎，作为适配器注册中心和调用中介
 * 3. 文昌引擎（Wenchang）- 业务引擎，负责具体的偏好管理功能
 *
 * 调用链：Tianshu → Taiyi → Wenchang
 */

import { TianshuEngine } from "../tianshu/core/TianshuEngine";
import { TaiyiEngine } from "../taiyi/core/TaiyiEngine";
import { WenchangAdapter } from "../adapters/WenchangAdapter";
// import { UICommand } from "../tianshu/types/commands";
import { join } from "path";

describe("三引擎集成测试 - RFC 0032 Phase 2", () => {
    let tianshuEngine: TianshuEngine;
    let taiyiEngine: TaiyiEngine;
    let wenchangAdapter: WenchangAdapter;

    beforeEach(async () => {
        // 1. 初始化文昌适配器（最底层）
        wenchangAdapter = new WenchangAdapter();
        await wenchangAdapter.initialize();

        // 2. 初始化太乙引擎并注册文昌适配器（中间层）
        taiyiEngine = new TaiyiEngine({
            enableHealthCheck: true,
            healthCheckInterval: 30000,
        });

        await taiyiEngine.initialize();
        // 注册文昌适配器到太乙引擎

        // 3. 初始化天枢引擎（最上层，编排层）
        tianshuEngine = new TianshuEngine({
            workflowDir: join(__dirname, "../../tianshu/workflows"),
            maxConcurrentWorkflows: 5,
            defaultTimeout: 30000,
            enableHotReload: false,
        });

        await tianshuEngine.initialize();
    });

    afterEach(async () => {
        await tianshuEngine?.shutdown();
        await taiyiEngine?.shutdown();
        await wenchangAdapter?.shutdown();
    });

    describe("基础引擎协同验证", () => {
        it("应该成功建立三引擎通信链路", async () => {
            // 验证天枢引擎状态（最上层）
            expect(tianshuEngine).toBeDefined();

            // 验证太乙引擎状态（中间层）
            expect(taiyiEngine).toBeDefined();

            // 验证文昌适配器状态（最底层）
            expect(wenchangAdapter).toBeDefined();

            // 验证太乙引擎可以获取可用引擎列表
            const availableEngines = taiyiEngine.getAvailableEngines();
            expect(Array.isArray(availableEngines)).toBe(true);
        });

        it("应该能够通过太乙引擎调用文昌引擎功能", async () => {
            // 通过太乙引擎获取文昌当前偏好快照
            const result = await taiyiEngine.callEngine("wenchang", "getCurrentSnapshot");

            expect(result.success).toBe(true);
            expect(result.result).toBeDefined();
            expect(result.engineName).toBe("wenchang");
            expect(result.timestamp).toBeGreaterThan(0);
        });

        it("应该能够处理引擎调用错误并正确传播", async () => {
            // 测试调用不存在的引擎方法
            const result = await taiyiEngine.callEngine("wenchang", "nonExistentMethod");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.engineName).toBe("wenchang");
        });
    });

    describe("端到端工作流验证", () => {
        it("应该能够通过天枢引擎处理偏好获取请求", async () => {
            // 使用天枢引擎的服务适配器接口
            const result = await tianshuEngine.handlePreferenceGet();

            expect(result).toBeDefined();
            expect(result.revision).toBeDefined();
            expect(result.ui).toBeDefined();
            expect(result.display).toBeDefined();
            expect(result.scanning).toBeDefined();
        });

        it("应该能够通过天枢引擎处理偏好更新请求", async () => {
            // 使用天枢引擎的服务适配器接口进行更新
            const delta = {
                ui: {
                    theme: "dark",
                    language: "zh-CN",
                },
                display: {
                    thumbnailSize: 200,
                    sortOrder: "dateDesc",
                },
            };

            const newRevision = await tianshuEngine.handlePreferenceUpdate(delta);

            expect(newRevision).toBeDefined();
            expect(typeof newRevision).toBe("number");
            expect(newRevision).toBeGreaterThan(0);
        });

        it("应该能够通过天枢引擎获取系统状态", async () => {
            const systemStatus = await tianshuEngine.getSystemStatus();

            expect(systemStatus).toBeDefined();
            expect(systemStatus.overallStatus).toBeDefined();
            expect(systemStatus.timestamp).toBeGreaterThan(0);
            expect(systemStatus.engines).toBeDefined();
            expect(Array.isArray(systemStatus.engines)).toBe(true);
        });

        it("应该能够通过天枢引擎处理偏好重置请求", async () => {
            const resetResult = await tianshuEngine.handlePreferenceReset();

            expect(resetResult).toBeDefined();
            expect(resetResult.revision).toBeDefined();
            expect(resetResult.ui).toBeDefined();
            expect(resetResult.display).toBeDefined();
            expect(resetResult.scanning).toBeDefined();
        });
    });

    describe("错误处理和异常场景验证", () => {
        it("应该正确处理不存在的引擎调用", async () => {
            const result = await taiyiEngine.callEngine("nonexistent", "anyMethod");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.engineName).toBe("nonexistent");
        });
    });

    describe("性能和并发验证", () => {
        it("应该支持高频率引擎调用", async () => {
            const callCount = 10;
            const calls = Array.from({ length: callCount }, () =>
                taiyiEngine.callEngine("wenchang", "getCurrentSnapshot"),
            );

            const startTime = Date.now();
            const results = await Promise.all(calls);
            const endTime = Date.now();

            // 验证所有调用都成功
            results.forEach((result) => {
                expect(result.success).toBe(true);
            });

            // 验证平均响应时间合理
            const avgResponseTime = (endTime - startTime) / callCount;
            expect(avgResponseTime).toBeLessThan(1000); // 平均1秒内响应
        });
    });
});
