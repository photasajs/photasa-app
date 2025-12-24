import { describe, it, expect, vi } from "vitest";
import { scanMonitoringService, type ScanMonitorConfig } from "../yushinan/scan-monitoring-service";

// Mock Vue
vi.mock("vue", () => ({
    ref: vi.fn((value) => ({ value })),
    computed: vi.fn((fn) => ({ value: fn() })),
}));

// Mock usePreferenceStore
vi.mock("@renderer/stores/preference", () => ({
    usePreferenceStore: vi.fn(() => ({
        scanningFolder: [
            { path: "/test/folder1", action: "scan" },
            { path: "/test/folder2", action: "rescan" },
        ],
    })),
}));

// Mock logger
vi.mock("@common/logger", () => ({
    loggers: {
        scan: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        },
    },
}));

describe("ScanMonitoringService", () => {
    describe("配置管理", () => {
        it("应该使用默认配置初始化", () => {
            const status = scanMonitoringService.getMonitoringStatus();

            expect(status.config.healthCheckInterval).toBe(5 * 60 * 1000);
            expect(status.config.staleTimeout).toBe(30 * 60 * 1000);
            expect(status.config.idleTimeout).toBe(5 * 60 * 1000);
            expect(status.config.maxRetries).toBe(3);
            expect(status.config.enableAutoRecovery).toBe(true);
        });

        it("应该能够更新配置", () => {
            const newConfig: Partial<ScanMonitorConfig> = {
                healthCheckInterval: 10 * 60 * 1000,
                maxRetries: 5,
            };

            scanMonitoringService.updateConfig(newConfig);
            const status = scanMonitoringService.getMonitoringStatus();

            expect(status.config.healthCheckInterval).toBe(10 * 60 * 1000);
            expect(status.config.maxRetries).toBe(5);
        });
    });

    describe("监控生命周期", () => {
        it("应该能够启动和停止监控", () => {
            // 测试启动监控
            scanMonitoringService.startMonitoring();
            const status = scanMonitoringService.getMonitoringStatus();
            expect(status.isMonitoring).toBe(true);

            // 测试停止监控
            scanMonitoringService.stopMonitoring();
            const statusAfterStop = scanMonitoringService.getMonitoringStatus();
            expect(statusAfterStop.isMonitoring).toBe(false);
        });
    });

    describe("健康状态", () => {
        it("应该提供健康状态信息", () => {
            const healthStatus = scanMonitoringService.healthStatus.value;

            expect(typeof healthStatus.isHealthy).toBe("boolean");
            expect(typeof healthStatus.isIdle).toBe("boolean");
            expect(typeof healthStatus.isStale).toBe("boolean");
            expect(typeof healthStatus.queueLength).toBe("number");
            expect(typeof healthStatus.consecutiveFailures).toBe("number");
            expect(typeof healthStatus.lastActivityTime).toBe("number");
            expect(typeof healthStatus.message).toBe("string");
        });
    });

    describe("手动检查和重置", () => {
        it("应该能够执行手动健康检查", () => {
            expect(() => scanMonitoringService.checkHealthNow()).not.toThrow();
        });

        it("应该能够重置状态", () => {
            expect(() => scanMonitoringService.reset()).not.toThrow();
        });
    });
});
