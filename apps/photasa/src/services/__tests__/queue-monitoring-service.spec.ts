/**
 * Tests for QueueMonitoringService
 * Ensures proper queue monitoring, metrics collection, and reactive state management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { QueueMonitoringService } from "@renderer/services/queue-monitoring-service";
import type { QueueMonitoringConfig } from "@photasa/common";
import type { ScanQueueItem } from "@renderer/stores/scanning-types";

// Mock logger
vi.mock("@photasa/common", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@photasa/common")>();
    return {
        ...actual,
        loggers: {
            app: {
                info: vi.fn(),
                debug: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            },
        },
    };
});

function createQueueItem(
    overrides: Partial<ScanQueueItem> & Pick<ScanQueueItem, "path">,
): ScanQueueItem {
    return {
        action: "scan",
        status: "pending",
        createdAt: Date.now(),
        source: "user",
        retryCount: 0,
        maxRetries: 3,
        operationType: "directory",
        thumbnailSize: 150,
        ...overrides,
    };
}

describe("QueueMonitoringService", () => {
    let service: QueueMonitoringService;
    let mockQueue: ScanQueueItem[];

    beforeEach(() => {
        service = new QueueMonitoringService();
        mockQueue = [];
        service.setQueueProvider(() => mockQueue);

        vi.clearAllTimers();
        vi.useFakeTimers();
    });

    afterEach(() => {
        service.stopMonitoring();
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    describe("Service initialization", () => {
        it("应该正确初始化服务", () => {
            expect(service.metrics.value.currentSize).toBe(0);
            expect(service.status.value).toBe("idle");
            expect(service.isMonitoring.value).toBe(false);
            expect(service.chartDataHistory).toEqual([]);
        });

        it("应该使用默认配置", () => {
            const config = (service as any).config;
            expect(config.updateInterval).toBe(5000);
            expect(config.maxHistoryEntries).toBe(100);
            expect(config.queueSizeWarningThreshold).toBe(1000);
            expect(config.errorRateWarningThreshold).toBe(5);
        });
    });

    describe("Monitoring lifecycle", () => {
        it("应该能启动监控", () => {
            expect(service.isMonitoring.value).toBe(false);

            service.startMonitoring();

            expect(service.isMonitoring.value).toBe(true);
        });

        it("应该防止重复启动监控", () => {
            service.startMonitoring();
            const firstMonitoringState = service.isMonitoring.value;

            service.startMonitoring();

            expect(service.isMonitoring.value).toBe(firstMonitoringState);
        });

        it("应该能停止监控", () => {
            service.startMonitoring();
            expect(service.isMonitoring.value).toBe(true);

            service.stopMonitoring();

            expect(service.isMonitoring.value).toBe(false);
        });

        it("应该设置和清理定时器", () => {
            const setIntervalSpy = vi.spyOn(global, "setInterval");
            const clearIntervalSpy = vi.spyOn(global, "clearInterval");

            service.startMonitoring();
            expect(setIntervalSpy).toHaveBeenCalled();

            service.stopMonitoring();
            expect(clearIntervalSpy).toHaveBeenCalled();
        });
    });

    describe("Configuration management", () => {
        it("应该能更新配置", () => {
            const newConfig: Partial<QueueMonitoringConfig> = {
                updateInterval: 3000,
                queueSizeWarningThreshold: 500,
            };

            service.updateConfig(newConfig);

            const config = (service as any).config;
            expect(config.updateInterval).toBe(3000);
            expect(config.queueSizeWarningThreshold).toBe(500);
        });

        it("配置更新时应该重启监控", () => {
            service.startMonitoring();
            const stopSpy = vi.spyOn(service, "stopMonitoring");
            const startSpy = vi.spyOn(service, "startMonitoring");

            service.updateConfig({ updateInterval: 3000 });

            expect(stopSpy).toHaveBeenCalled();
            expect(startSpy).toHaveBeenCalled();
        });

        it("未监控时更新配置不应重启监控", () => {
            const stopSpy = vi.spyOn(service, "stopMonitoring");
            const startSpy = vi.spyOn(service, "startMonitoring");

            service.updateConfig({ updateInterval: 3000 });

            expect(stopSpy).not.toHaveBeenCalled();
            expect(startSpy).not.toHaveBeenCalled();
        });
    });

    describe("Metrics collection", () => {
        it("应该从空队列收集基础指标", () => {
            mockQueue = [];

            service.startMonitoring();
            vi.advanceTimersByTime(100);

            const metrics = service.metrics.value;
            expect(metrics.currentSize).toBe(0);
            expect(metrics.statusCounts.pending).toBe(0);
            expect(metrics.statusCounts.processing).toBe(0);
            expect(metrics.statusCounts.completed).toBe(0);
            expect(metrics.statusCounts.failed).toBe(0);
        });

        it("应该正确计算队列大小", () => {
            mockQueue = [
                createQueueItem({ path: "/test1", status: "pending" }),
                createQueueItem({ path: "/test2", status: "processing" }),
            ];

            service.startMonitoring();
            vi.advanceTimersByTime(100);

            expect(service.metrics.value.currentSize).toBe(2);
        });

        it("应该正确计算状态统计", () => {
            mockQueue = [
                createQueueItem({ path: "/test1", status: "pending" }),
                createQueueItem({ path: "/test2", status: "processing" }),
                createQueueItem({ path: "/test3", status: "failed" }),
            ];

            service.startMonitoring();
            vi.advanceTimersByTime(100);

            const statusCounts = service.metrics.value.statusCounts;
            expect(statusCounts.pending).toBe(1);
            expect(statusCounts.processing).toBe(1);
            expect(statusCounts.failed).toBe(1);
            expect(statusCounts.completed).toBe(0);
        });

        it("应该累计本会话完成数", () => {
            mockQueue = [createQueueItem({ path: "/test1", status: "processing" })];
            service.startMonitoring();
            vi.advanceTimersByTime(100);

            mockQueue = [];
            vi.advanceTimersByTime(5000);

            expect(service.metrics.value.statusCounts.completed).toBe(1);
        });

        it("应该正确计算事件类型分布", () => {
            mockQueue = [
                createQueueItem({ path: "/test1", action: "scan", status: "pending" }),
                createQueueItem({ path: "/test2", action: "scan", status: "processing" }),
                createQueueItem({ path: "/test3", action: "rescan", status: "failed" }),
            ];

            service.startMonitoring();
            vi.advanceTimersByTime(100);

            const eventTypes = service.metrics.value.eventTypes;
            expect(eventTypes["scan"]).toBe(2);
            expect(eventTypes["rescan"]).toBe(1);
        });

        it("应该估算内存使用量", () => {
            mockQueue = Array.from({ length: 100 }, (_, i) =>
                createQueueItem({ path: `/test${i}`, status: "pending" }),
            );

            service.startMonitoring();
            vi.advanceTimersByTime(100);

            const memoryUsage = service.metrics.value.memoryUsage;
            expect(memoryUsage).toBeGreaterThan(0);
            expect(memoryUsage).toBeLessThan(1);
        });

        it("应该更新最后更新时间", () => {
            const beforeTime = new Date();

            service.startMonitoring();
            vi.advanceTimersByTime(100);

            const afterTime = new Date();
            const lastUpdated = service.metrics.value.lastUpdated;

            expect(lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(lastUpdated.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        });
    });

    describe("Queue health calculation", () => {
        it("应该计算良好的队列健康状态", () => {
            mockQueue = [createQueueItem({ path: "/test1", status: "pending" })];

            service.startMonitoring();
            vi.advanceTimersByTime(100);

            expect(service.queueHealth.value).toBe("good");
        });

        it("应该在队列过大时显示警告", () => {
            service.updateConfig({ queueSizeWarningThreshold: 2 });
            mockQueue = [
                createQueueItem({ path: "/test1", status: "pending" }),
                createQueueItem({ path: "/test2", status: "pending" }),
                createQueueItem({ path: "/test3", status: "pending" }),
            ];

            service.startMonitoring();
            vi.advanceTimersByTime(100);

            expect(service.queueHealth.value).toBe("warning");
        });
    });

    describe("Control actions", () => {
        it("应该处理暂停操作", async () => {
            const result = await service.executeControlAction("pause");
            expect(result).toBe(false);
        });

        it("应该处理恢复操作", async () => {
            const result = await service.executeControlAction("resume");
            expect(result).toBe(false);
        });

        it("应该处理清理已完成操作", async () => {
            const result = await service.executeControlAction("clear-completed");
            expect(result).toBe(true);
        });

        it("应该处理清理失败操作", async () => {
            const result = await service.executeControlAction("clear-failed");
            expect(result).toBe(true);
        });

        it("应该处理清理所有操作", async () => {
            const result = await service.executeControlAction("clear-all");
            expect(result).toBe(true);
        });

        it("应该处理重试失败操作", async () => {
            const result = await service.executeControlAction("retry-failed");
            expect(result).toBe(true);
        });

        it("应该处理未知操作", async () => {
            const result = await service.executeControlAction("unknown" as any);
            expect(result).toBe(false);
        });
    });

    describe("Data export and reset", () => {
        it("应该导出指标数据", () => {
            service.startMonitoring();
            vi.advanceTimersByTime(100);

            const exported = service.exportMetrics();
            const data = JSON.parse(exported);

            expect(data.metrics).toBeDefined();
            expect(data.chartData).toBeDefined();
            expect(data.config).toBeDefined();
            expect(data.exportedAt).toBeDefined();
        });

        it("应该重置所有数据", () => {
            mockQueue = [createQueueItem({ path: "/test1", status: "pending" })];

            service.startMonitoring();
            vi.advanceTimersByTime(100);

            expect(service.metrics.value.currentSize).toBeGreaterThan(0);

            service.reset();

            expect(service.metrics.value.currentSize).toBe(0);
            expect(service.status.value).toBe("idle");
            expect(service.chartDataHistory).toEqual([]);
        });
    });

    describe("Chart data management", () => {
        it("应该维护图表数据历史", () => {
            service.startMonitoring();
            vi.advanceTimersByTime(100);

            const chartData = service.chartDataHistory;
            expect(Array.isArray(chartData)).toBe(true);
        });

        it("应该限制图表数据点数量", () => {
            service.updateConfig({ updateInterval: 100 });
            service.startMonitoring();

            for (let i = 0; i < 100; i++) {
                vi.advanceTimersByTime(100);
            }

            const maxDataPoints = Math.ceil(3600 / (100 / 1000));
            expect(service.chartDataHistory.length).toBeLessThanOrEqual(maxDataPoints);
        });
    });

    describe("Error handling", () => {
        it("应该处理收集指标时的错误", () => {
            service.setQueueProvider(() => {
                throw new Error("Provider error");
            });

            service.startMonitoring();
            vi.advanceTimersByTime(100);

            expect(service.status.value).toBe("error");
        });

        it("未设置队列来源时应标记错误", () => {
            const freshService = new QueueMonitoringService();
            freshService.startMonitoring();
            vi.advanceTimersByTime(100);

            expect(freshService.status.value).toBe("error");
            freshService.stopMonitoring();
        });
    });

    describe("Status updates", () => {
        it("应该在空队列时设置闲置状态", () => {
            mockQueue = [];

            service.startMonitoring();
            vi.advanceTimersByTime(100);

            expect(service.status.value).toBe("idle");
        });

        it("应该在有处理中操作时设置活跃状态", () => {
            mockQueue = [createQueueItem({ path: "/test1", status: "processing" })];

            service.startMonitoring();
            vi.advanceTimersByTime(100);

            expect(service.status.value).toBe("active");
        });
    });
});
