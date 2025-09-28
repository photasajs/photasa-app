/**
 * MaLiang Worker适配器
 * 用于在Worker进程中运行Ma-Liang引擎
 */

import { parentPort, Worker } from "worker_threads";
import type { PhotasaLogger } from "@common/logger";
import { MaLiang } from "../core/MaLiang";
import type { PaintRequest, PaintResult } from "../types/BrushTypes";

// 导入必要的神笔
import { BmpBrush } from "../brushes/image/BmpBrush";
import { MpegBrush } from "../brushes/ffmpeg/MpegBrush";

/**
 * Worker消息类型
 */
export enum WorkerMessageType {
    PROCESS = "process",
    BATCH = "batch",
    INITIALIZE = "initialize",
    CLEANUP = "cleanup",
    GET_STATS = "get_stats",
}

/**
 * Worker消息
 */
export interface WorkerMessage {
    id: string;
    type: WorkerMessageType;
    payload: any;
}

/**
 * Worker响应
 */
export interface WorkerResponse {
    id: string;
    type?: string;
    success: boolean;
    result?: any;
    error?: string;
    stats?: any;
}

/**
 * MaLiang Worker类
 * 在独立线程中处理图像任务
 */
export class MaLiangWorker {
    private maLiang: MaLiang | null = null;
    private logger?: PhotasaLogger;
    private taskCount = 0;
    private startTime: number = Date.now();

    constructor() {
        this.setupMessageHandler();
    }

    /**
     * 设置消息处理器
     */
    private setupMessageHandler(): void {
        if (!parentPort) {
            throw new Error("MaLiangWorker必须在Worker线程中运行");
        }

        parentPort.on("message", async (message: WorkerMessage) => {
            try {
                const response = await this.handleMessage(message);
                parentPort?.postMessage(response);
            } catch (error) {
                const errorResponse: WorkerResponse = {
                    id: message.id,
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                };
                parentPort?.postMessage(errorResponse);
            }
        });

        // Worker就绪信号
        parentPort.postMessage({ type: "ready" });
    }

    /**
     * 处理消息
     */
    private async handleMessage(message: WorkerMessage): Promise<WorkerResponse> {
        switch (message.type) {
            case WorkerMessageType.INITIALIZE:
                return this.initialize(message);

            case WorkerMessageType.PROCESS:
                return this.processRequest(message);

            case WorkerMessageType.BATCH:
                return this.processBatch(message);

            case WorkerMessageType.GET_STATS:
                return this.getStats(message);

            case WorkerMessageType.CLEANUP:
                return this.cleanup(message);

            default:
                throw new Error(`未知的消息类型: ${message.type}`);
        }
    }

    /**
     * 初始化引擎
     */
    private async initialize(message: WorkerMessage): Promise<WorkerResponse> {
        const config = message.payload;

        this.maLiang = new MaLiang(
            {
                debug: config?.debug ?? false,
                performance: {
                    enableMonitoring: true,
                    logSlowOperations: false, // Worker中不记录慢操作
                    slowOperationThreshold: 30000, // 30秒阈值
                },
                cache: {
                    enabled: false, // Worker不使用缓存，避免内存问题
                    maxSize: 0,
                    ttl: 0,
                    strategy: "lru" as const,
                },
            },
            this.logger,
        );

        // 注册神笔
        this.registerBrushes();

        return {
            id: message.id,
            success: true,
            result: {
                message: "Worker初始化成功",
                supportedFormats: this.getSupportedFormats(),
            },
        };
    }

    /**
     * 注册神笔
     */
    private registerBrushes(): void {
        if (!this.maLiang) {
            throw new Error("引擎未初始化");
        }

        const brushes = [
            new BmpBrush(),
            new MpegBrush(),
            // TODO: 添加其他神笔
        ];

        brushes.forEach((brush) => {
            this.maLiang!.registerBrush(brush);
        });
    }

    /**
     * 处理单个请求
     */
    private async processRequest(message: WorkerMessage): Promise<WorkerResponse> {
        if (!this.maLiang) {
            throw new Error("引擎未初始化");
        }

        const request: PaintRequest = message.payload;
        this.taskCount++;

        try {
            const result = await this.maLiang.paint(request);
            return {
                id: message.id,
                success: true,
                result,
                stats: this.getWorkerStats(),
            };
        } catch (error) {
            return {
                id: message.id,
                success: false,
                error: error instanceof Error ? error.message : "处理失败",
                stats: this.getWorkerStats(),
            };
        }
    }

    /**
     * 批量处理
     */
    private async processBatch(message: WorkerMessage): Promise<WorkerResponse> {
        if (!this.maLiang) {
            throw new Error("引擎未初始化");
        }

        const requests: PaintRequest[] = message.payload;
        const results: Array<{ success: boolean; result?: PaintResult; error?: string }> = [];

        for (const request of requests) {
            this.taskCount++;
            try {
                const result = await this.maLiang.paint(request);
                results.push({ success: true, result });
            } catch (error) {
                results.push({
                    success: false,
                    error: error instanceof Error ? error.message : "处理失败",
                });
            }
        }

        const successful = results.filter((r) => r.success).length;
        const failed = results.length - successful;

        return {
            id: message.id,
            success: true,
            result: {
                total: results.length,
                successful,
                failed,
                results,
            },
            stats: this.getWorkerStats(),
        };
    }

    /**
     * 获取统计信息
     */
    private async getStats(message: WorkerMessage): Promise<WorkerResponse> {
        if (!this.maLiang) {
            throw new Error("引擎未初始化");
        }

        const engineStats = this.maLiang.getStatistics();
        const workerStats = this.getWorkerStats();

        return {
            id: message.id,
            success: true,
            result: {
                engine: engineStats,
                worker: workerStats,
            },
        };
    }

    /**
     * 清理资源
     */
    private async cleanup(message: WorkerMessage): Promise<WorkerResponse> {
        if (this.maLiang) {
            await this.maLiang.cleanup();
            this.maLiang = null;
        }

        return {
            id: message.id,
            success: true,
            result: {
                message: "Worker清理完成",
                finalStats: this.getWorkerStats(),
            },
        };
    }

    /**
     * 获取支持的格式
     */
    private getSupportedFormats(): string[] {
        if (!this.maLiang) {
            return [];
        }

        const brushes = this.maLiang.listBrushes();
        const formats = new Set<string>();

        brushes.forEach((brush) => {
            brush.supportedFormats.forEach((format) => formats.add(format));
        });

        return Array.from(formats);
    }

    /**
     * 获取Worker统计信息
     */
    private getWorkerStats() {
        const uptime = Date.now() - this.startTime;
        const memoryUsage = process.memoryUsage();

        return {
            taskCount: this.taskCount,
            uptime,
            memory: {
                rss: memoryUsage.rss,
                heapTotal: memoryUsage.heapTotal,
                heapUsed: memoryUsage.heapUsed,
                external: memoryUsage.external,
            },
            averageTaskTime: this.taskCount > 0 ? uptime / this.taskCount : 0,
        };
    }
}

// 如果作为Worker运行，自动启动
if (parentPort) {
    new MaLiangWorker();
}

/**
 * Worker池管理器（在主进程中使用）
 */
export class MaLiangWorkerPool {
    private workers: Worker[] = [];
    private freeWorkers: Worker[] = [];
    private taskQueue: Array<{
        request: PaintRequest;
        resolve: (result: PaintResult) => void;
        reject: (error: Error) => void;
    }> = [];

    constructor(
        private poolSize: number = 4,
        private logger?: PhotasaLogger,
    ) {
        this.initializePool();
    }

    /**
     * 初始化Worker池
     */
    private initializePool(): void {
        for (let i = 0; i < this.poolSize; i++) {
            const worker = new Worker(__filename);

            worker.on("message", (response: WorkerResponse) => {
                if (response.type === "ready") {
                    this.freeWorkers.push(worker);
                    this.logger?.debug(`Worker ${i} 就绪`);
                }
            });

            worker.on("error", (error: Error) => {
                this.logger?.error(`Worker ${i} 错误:`, error);
            });

            this.workers.push(worker);
        }
    }

    /**
     * 处理请求
     */
    public async process(request: PaintRequest): Promise<PaintResult> {
        return new Promise((resolve, reject) => {
            this.taskQueue.push({ request, resolve, reject });
            this.processNext();
        });
    }

    /**
     * 处理下一个任务
     */
    private processNext(): void {
        if (this.taskQueue.length === 0 || this.freeWorkers.length === 0) {
            return;
        }

        const worker = this.freeWorkers.pop();
        const task = this.taskQueue.shift();

        if (!worker || !task) {
            return;
        }

        const messageId = Math.random().toString(36).substring(2, 11);
        const message: WorkerMessage = {
            id: messageId,
            type: WorkerMessageType.PROCESS,
            payload: task.request,
        };

        const handler = (response: WorkerResponse) => {
            if (response.id !== messageId) {
                return;
            }

            worker.off("message", handler);
            this.freeWorkers.push(worker);

            if (response.success) {
                task.resolve(response.result);
            } else {
                task.reject(new Error(response.error || "Worker处理失败"));
            }

            this.processNext();
        };

        worker.on("message", handler);
        worker.postMessage(message);
    }

    /**
     * 关闭Worker池
     */
    public async terminate(): Promise<void> {
        await Promise.all(
            this.workers.map(async (worker) => {
                try {
                    await worker.terminate();
                } catch (error: unknown) {
                    this.logger?.error("Worker终止失败:", error);
                }
            }),
        );

        this.workers = [];
        this.freeWorkers = [];
        this.taskQueue = [];

        this.logger?.info("Worker池已关闭");
    }
}
