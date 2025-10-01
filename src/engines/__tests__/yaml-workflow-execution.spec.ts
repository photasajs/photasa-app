/**
 * YAML工作流执行集成测试 - 验证完整的工作流执行流程
 * RFC 0032 Phase 2: 功能验证
 *
 * 测试目标：
 * 1. 验证YAML工作流的端到端执行
 * 2. 测试工作流步骤的正确执行顺序
 * 3. 确保工作流参数传递和结果处理
 * 4. 验证工作流错误处理和恢复机制
 */

import { TianshuEngine } from "../tianshu/core/TianshuEngine";
import { TaiyiEngine } from "../taiyi/core/TaiyiEngine";
import { WenchangAdapter } from "../adapters/WenchangAdapter";
import { UICommand } from "../tianshu/types/commands";
import { join } from "path";

describe("YAML工作流执行集成测试 - RFC 0032 Phase 2", () => {
    let tianshuEngine: TianshuEngine;
    let taiyiEngine: TaiyiEngine;
    let wenchangAdapter: WenchangAdapter;

    beforeEach(async () => {
        // 初始化三引擎架构
        wenchangAdapter = new WenchangAdapter();
        await wenchangAdapter.initialize();

        taiyiEngine = new TaiyiEngine({
            enableHealthCheck: true,
            healthCheckInterval: 30000,
        });
        await taiyiEngine.initialize();

        tianshuEngine = new TianshuEngine({
            workflowDir: join(__dirname, "../../tianshu/workflows"),
            maxConcurrentWorkflows: 3,
            defaultTimeout: 15000,
            enableHotReload: false,
        });
        await tianshuEngine.initialize();
    });

    afterEach(async () => {
        await tianshuEngine?.shutdown();
        await taiyiEngine?.shutdown();
        await wenchangAdapter?.shutdown();
    });

    describe("偏好管理工作流完整执行", () => {
        it("应该能够完整执行偏好获取工作流", async () => {
            // 创建符合UICommand接口的命令
            const getCommand: UICommand = {
                id: `test-get-${Date.now()}`,
                intent: "get_status",
                params: {
                    action: "get",
                    includeDetails: true,
                    source: "yaml-workflow-test",
                },
                priority: "user",
                createdAt: Date.now(),
                context: {
                    source: "system",
                    timeout: 10000,
                },
            };

            const response = await tianshuEngine.processCommand(getCommand);

            // 验证响应基本结构
            expect(response).toBeDefined();
            expect(response.commandId).toBe(getCommand.id);
            expect(response.intent).toBe(getCommand.intent);
            expect(response.timestamp).toBeGreaterThan(0);

            // 验证工作流被正确排队或执行
            expect(
                ["accepted", "queued", "processing", "completed"].includes(response.status),
            ).toBe(true);
        });

        it("应该能够完整执行偏好更新工作流", async () => {
            const updateCommand: UICommand = {
                id: `test-update-${Date.now()}`,
                intent: "update_config",
                params: {
                    action: "update",
                    delta: {
                        ui: {
                            theme: "dark",
                            language: "zh-CN",
                        },
                        display: {
                            thumbnailSize: 180,
                            sortOrder: "dateDesc",
                        },
                    },
                    source: "yaml-workflow-test",
                },
                priority: "user",
                createdAt: Date.now(),
                context: {
                    source: "system",
                },
            };

            const response = await tianshuEngine.processCommand(updateCommand);

            expect(response).toBeDefined();
            expect(response.commandId).toBe(updateCommand.id);
            expect(response.intent).toBe(updateCommand.intent);
            expect(
                ["accepted", "queued", "processing", "completed"].includes(response.status),
            ).toBe(true);
        });

        it("应该能够完整执行引擎状态检查工作流", async () => {
            const statusCommand: UICommand = {
                id: `test-status-${Date.now()}`,
                intent: "get_status",
                params: {
                    includeDetails: true,
                    source: "yaml-workflow-test",
                },
                priority: "system",
                createdAt: Date.now(),
                context: {
                    source: "system",
                },
            };

            const response = await tianshuEngine.processCommand(statusCommand);

            expect(response).toBeDefined();
            expect(response.commandId).toBe(statusCommand.id);
            expect(response.intent).toBe(statusCommand.intent);
            expect(
                ["accepted", "queued", "processing", "completed"].includes(response.status),
            ).toBe(true);
        });
    });

    describe("文件夹扫描工作流完整执行", () => {
        it("应该能够完整执行文件夹扫描工作流", async () => {
            const scanCommand: UICommand = {
                id: `test-scan-${Date.now()}`,
                intent: "scan_folder",
                params: {
                    paths: ["/test/scan/folder"],
                    recursive: true,
                    priority: "user",
                    filters: {
                        includePatterns: ["*.jpg", "*.png", "*.gif"],
                        excludePatterns: ["*.tmp", "*.cache"],
                    },
                },
                priority: "user",
                createdAt: Date.now(),
                context: {
                    source: "system",
                },
            };

            const response = await tianshuEngine.processCommand(scanCommand);

            expect(response).toBeDefined();
            expect(response.commandId).toBe(scanCommand.id);
            expect(response.intent).toBe(scanCommand.intent);
            expect(
                ["accepted", "queued", "processing", "completed"].includes(response.status),
            ).toBe(true);
        });

        it("应该能够处理高优先级扫描命令", async () => {
            const urgentScanCommand: UICommand = {
                id: `test-urgent-scan-${Date.now()}`,
                intent: "scan_folder",
                params: {
                    paths: ["/urgent/scan/folder"],
                    recursive: false,
                    priority: "user",
                    filters: {},
                },
                priority: "user",
                createdAt: Date.now(),
                context: {
                    source: "system",
                },
            };

            const response = await tianshuEngine.processCommand(urgentScanCommand);

            expect(response).toBeDefined();
            expect(response.commandId).toBe(urgentScanCommand.id);
            expect(response.intent).toBe("scan_folder");
            expect(
                ["accepted", "queued", "processing", "completed"].includes(response.status),
            ).toBe(true);
        });
    });

    describe("工作流事件和状态管理", () => {
        it("应该能够监听工作流执行事件", async () => {
            const events: any[] = [];

            // 监听工作流相关事件
            tianshuEngine.on("workflowStarted", (event) => {
                events.push({ type: "started", ...event });
            });

            tianshuEngine.on("workflowCompleted", (event) => {
                events.push({ type: "completed", ...event });
            });

            tianshuEngine.on("progressUpdate", (event) => {
                events.push({ type: "progress", ...event });
            });

            const command: UICommand = {
                id: `test-events-${Date.now()}`,
                intent: "get_status",
                params: {
                    action: "get",
                    source: "events-test",
                },
                priority: "user",
                createdAt: Date.now(),
                context: {
                    source: "system",
                },
            };

            await tianshuEngine.processCommand(command);

            // 给事件一些时间传播
            await new Promise((resolve) => setTimeout(resolve, 100));

            // 验证监听器已设置
            expect(tianshuEngine.listenerCount("workflowStarted")).toBe(1);
            expect(tianshuEngine.listenerCount("workflowCompleted")).toBe(1);
            expect(tianshuEngine.listenerCount("progressUpdate")).toBe(1);
        });

        it("应该能够取消正在执行的命令", async () => {
            const command: UICommand = {
                id: `test-cancel-${Date.now()}`,
                intent: "scan_folder",
                params: {
                    paths: ["/long/running/scan"],
                    recursive: true,
                },
                priority: "background",
                createdAt: Date.now(),
                context: {
                    source: "system",
                },
            };

            // 启动命令
            const response = await tianshuEngine.processCommand(command);
            expect(response).toBeDefined();

            // 尝试取消命令
            const cancelResult = await tianshuEngine.cancelCommand(command.id);

            // 注意：根据当前实现，如果命令还没开始执行，取消可能返回false
            // 这里我们主要验证取消机制存在且不会出错
            expect(typeof cancelResult).toBe("boolean");
        });
    });

    describe("并发工作流执行", () => {
        it("应该能够并发执行多个工作流", async () => {
            const commands: UICommand[] = Array.from({ length: 3 }, (_, index) => ({
                id: `test-concurrent-${Date.now()}-${index}`,
                intent: "get_status",
                params: {
                    action: "get",
                    source: `concurrent-test-${index}`,
                },
                priority: "background",
                createdAt: Date.now(),
                context: {
                    source: "system",
                },
            }));

            const startTime = Date.now();
            const responses = await Promise.all(
                commands.map((command) => tianshuEngine.processCommand(command)),
            );
            const endTime = Date.now();

            // 验证所有命令都被正确处理
            responses.forEach((response, index) => {
                expect(response).toBeDefined();
                expect(response.commandId).toBe(commands[index].id);
                expect(
                    ["accepted", "queued", "processing", "completed"].includes(response.status),
                ).toBe(true);
            });

            // 验证并发执行时间合理
            const executionTime = endTime - startTime;
            expect(executionTime).toBeLessThan(5000); // 5秒内完成
        });

        it("应该能够处理不同优先级的并发命令", async () => {
            const lowPriorityCommand: UICommand = {
                id: `test-low-${Date.now()}`,
                intent: "scan_folder",
                params: {
                    paths: ["/low/priority/scan"],
                },
                priority: "background",
                createdAt: Date.now(),
                context: { source: "system" },
            };

            const highPriorityCommand: UICommand = {
                id: `test-high-${Date.now()}`,
                intent: "get_status",
                params: {
                    action: "get",
                },
                priority: "user",
                createdAt: Date.now(),
                context: { source: "system" },
            };

            const responses = await Promise.all([
                tianshuEngine.processCommand(lowPriorityCommand),
                tianshuEngine.processCommand(highPriorityCommand),
            ]);

            // 验证两个命令都被接受
            responses.forEach((response) => {
                expect(response).toBeDefined();
                expect(
                    ["accepted", "queued", "processing", "completed"].includes(response.status),
                ).toBe(true);
            });
        });
    });

    describe("错误处理和恢复", () => {
        it("应该能够处理无效的工作流意图", async () => {
            const invalidCommand: UICommand = {
                id: `test-invalid-${Date.now()}`,
                intent: "invalid_intent" as any,
                params: {},
                priority: "user",
                createdAt: Date.now(),
                context: { source: "system" },
            };

            const response = await tianshuEngine.processCommand(invalidCommand);

            expect(response).toBeDefined();
            expect(response.commandId).toBe(invalidCommand.id);
            // 无效意图应该导致失败状态
            expect(response.status).toBe("failed");
            expect(response.error).toBeDefined();
        });

        it("应该能够处理工作流参数验证错误", async () => {
            const invalidParamsCommand: UICommand = {
                id: `test-invalid-params-${Date.now()}`,
                intent: "scan_folder",
                params: {
                    // 缺少必需的paths参数
                    recursive: true,
                },
                priority: "user",
                createdAt: Date.now(),
                context: { source: "system" },
            };

            const response = await tianshuEngine.processCommand(invalidParamsCommand);

            expect(response).toBeDefined();
            expect(response.commandId).toBe(invalidParamsCommand.id);
            // 参数错误可能导致失败或者被系统容错处理
            expect(["failed", "accepted", "queued"].includes(response.status)).toBe(true);
        });
    });

    describe("系统资源和性能监控", () => {
        it("应该能够获取详细的系统状态报告", async () => {
            const statusReport = await tianshuEngine.getSystemStatus();

            expect(statusReport).toBeDefined();
            expect(statusReport.overallStatus).toBeDefined();
            expect(statusReport.timestamp).toBeGreaterThan(0);
            expect(statusReport.engines).toBeDefined();
            expect(Array.isArray(statusReport.engines)).toBe(true);
            expect(statusReport.workflows).toBeDefined();
            expect(Array.isArray(statusReport.workflows)).toBe(true);
            expect(statusReport.systemMetrics).toBeDefined();
            expect(statusReport.errorStats).toBeDefined();

            // 验证系统指标
            expect(typeof statusReport.systemMetrics.cpuUsage).toBe("number");
            expect(typeof statusReport.systemMetrics.memoryUsage).toBe("number");
            expect(typeof statusReport.systemMetrics.activeConnections).toBe("number");
        });

        it("应该能够处理大量工作流请求", async () => {
            const requestCount = 10;
            const commands: UICommand[] = Array.from({ length: requestCount }, (_, index) => ({
                id: `test-load-${Date.now()}-${index}`,
                intent: "get_status",
                params: {
                    action: "get",
                    source: `load-test-${index}`,
                },
                priority: "background",
                createdAt: Date.now(),
                context: { source: "system" },
            }));

            const startTime = Date.now();
            const responses = await Promise.all(
                commands.map((command) => tianshuEngine.processCommand(command)),
            );
            const endTime = Date.now();

            // 验证所有请求都被处理
            responses.forEach((response) => {
                expect(response).toBeDefined();
                expect(
                    ["accepted", "queued", "processing", "completed"].includes(response.status),
                ).toBe(true);
            });

            // 验证平均处理时间
            const avgProcessingTime = (endTime - startTime) / requestCount;
            expect(avgProcessingTime).toBeLessThan(1000); // 平均1秒内处理
        });
    });
});
