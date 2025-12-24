import { loggers } from "@common/logger";
import * as Sentry from "@sentry/electron/main";
import isDev from "electron-is-dev";

const logger = loggers.main;

/**
 * 启动性能指标
 */
export interface StartupMetrics {
    appReady?: number;
    windowCreated?: number;
    servicesInitialized?: number;
    rendererLoaded?: number;
    splashShown?: number;
    splashHidden?: number;
    ipcHandlersRegistered?: number;
    totalTime?: number;
}

/**
 * 启动性能监控器
 * 用于测量和报告应用启动各个阶段的耗时
 */
export class StartupPerformanceMonitor {
    private startTime: number;
    private metrics: StartupMetrics = {};
    private milestones: Map<string, number> = new Map();

    constructor() {
        this.startTime = Date.now();
    }

    /**
     * 标记一个性能里程碑
     */
    mark(event: keyof StartupMetrics): void {
        const elapsed = Date.now() - this.startTime;
        this.metrics[event] = elapsed;
        this.milestones.set(event, elapsed);
        logger.debug(`Performance milestone: ${event} at ${elapsed}ms`);
    }

    /**
     * 标记自定义里程碑（不在 StartupMetrics 中定义的）
     */
    markCustom(event: string): void {
        const elapsed = Date.now() - this.startTime;
        this.milestones.set(event, elapsed);
        logger.debug(`Custom milestone: ${event} at ${elapsed}ms`);
    }

    /**
     * 获取两个里程碑之间的时间差
     */
    getDuration(startEvent: string, endEvent: string): number | null {
        const start = this.milestones.get(startEvent);
        const end = this.milestones.get(endEvent);

        if (start === undefined || end === undefined) {
            return null;
        }

        return end - start;
    }

    /**
     * 获取从启动到某个里程碑的时间
     */
    getElapsed(event: string): number | null {
        return this.milestones.get(event) ?? null;
    }

    /**
     * 报告性能指标
     */
    report(): void {
        this.metrics.totalTime = Date.now() - this.startTime;

        // 计算各阶段耗时
        const phases = {
            initialization: this.getDuration("start", "appReady"),
            windowCreation: this.getDuration("appReady", "windowCreated"),
            serviceInit: this.getDuration("windowCreated", "servicesInitialized"),
            rendering: this.getDuration("servicesInitialized", "rendererLoaded"),
            transition: this.getDuration("rendererLoaded", "splashHidden"),
        };

        logger.info("=== Startup Performance Report ===");
        logger.info(`Milestones: ${JSON.stringify(this.metrics)}`);
        logger.info(
            `Phase Durations: ${JSON.stringify({
                ...phases,
                total: `${this.metrics.totalTime}ms`,
            })}`,
        );

        // 性能警告
        if (this.metrics.totalTime && this.metrics.totalTime > 3000) {
            logger.warn(`Slow startup detected: ${this.metrics.totalTime}ms (target: < 3000ms)`);
        }

        // 发送到分析服务（生产环境）
        if (!isDev) {
            this.sendToAnalytics(this.metrics, phases);
        }
    }

    /**
     * 发送性能数据到 Sentry
     */
    private sendToAnalytics(metrics: StartupMetrics, phases: any): void {
        try {
            // 发送自定义性能事件到 Sentry
            Sentry.captureMessage("Startup Performance", {
                level: "info",
                extra: {
                    metrics,
                    phases,
                    platform: process.platform,
                    arch: process.arch,
                    nodeVersion: process.version,
                },
            });

            // 如果启动时间过长，发送警告
            if (metrics.totalTime && metrics.totalTime > 5000) {
                Sentry.captureMessage("Slow Application Startup", {
                    level: "warning",
                    extra: {
                        totalTime: metrics.totalTime,
                        metrics,
                        phases,
                    },
                });
            }
        } catch (error) {
            logger.error("Failed to send performance metrics to Sentry:", error);
        }
    }

    /**
     * 获取格式化的性能报告
     */
    getFormattedReport(): string {
        const lines: string[] = [
            "=== Startup Performance ===",
            `Total Time: ${this.metrics.totalTime || Date.now() - this.startTime}ms`,
            "",
            "Milestones:",
        ];

        this.milestones.forEach((time, event) => {
            lines.push(`  ${event}: ${time}ms`);
        });

        return lines.join("\n");
    }

    /**
     * 重置监控器
     */
    reset(): void {
        this.startTime = Date.now();
        this.metrics = {};
        this.milestones.clear();
    }
}

// 导出单例实例
export const startupMonitor = new StartupPerformanceMonitor();
