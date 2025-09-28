/**
 * MaLiang服务适配器
 * 提供主进程中使用Ma-Liang引擎的标准服务接口
 */

import { ipcMain } from "electron";
import type { PhotasaLogger } from "@common/logger";
import { MaLiang } from "../core/MaLiang";
import type { PaintRequest, PaintResult } from "../types/BrushTypes";
import { ValidationError, FormatError, type MaLiangError } from "../core/ErrorManager";

// 导入所有神笔
import { BmpBrush } from "../brushes/image/BmpBrush";
import { MpegBrush } from "../brushes/ffmpeg/MpegBrush";
// TODO: 导入其他神笔

/**
 * 服务配置
 */
export interface MaLiangServiceConfig {
    debug?: boolean;
    enableCache?: boolean;
    cacheSize?: number;
    enableMonitoring?: boolean;
    concurrency?: number;
}

/**
 * 安全结果包装
 */
export interface SafeResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    errorCode?: string;
    details?: any;
}

/**
 * 批处理结果
 */
export interface BatchResult {
    total: number;
    successful: number;
    failed: number;
    results: Array<SafeResult<PaintResult>>;
    duration: number;
}

/**
 * Ma-Liang服务类
 * 单例模式，提供统一的图像处理服务
 */
export class MaLiangService {
    private static instance: MaLiangService;
    private maLiang!: MaLiang; // 在init中初始化

    private constructor(
        private config: MaLiangServiceConfig = {},
        private logger?: PhotasaLogger,
    ) {
        this.initializeEngine();
    }

    /**
     * 获取服务实例
     */
    public static getInstance(
        config?: MaLiangServiceConfig,
        logger?: PhotasaLogger,
    ): MaLiangService {
        if (!this.instance) {
            this.instance = new MaLiangService(config, logger);
        }
        return this.instance;
    }

    /**
     * 初始化引擎
     */
    private initializeEngine(): void {
        this.maLiang = new MaLiang(
            {
                debug: this.config.debug ?? false,
                performance: {
                    enableMonitoring: this.config.enableMonitoring ?? true,
                    logSlowOperations: true,
                    slowOperationThreshold: 5000,
                },
                cache: {
                    enabled: this.config.enableCache ?? true,
                    maxSize: this.config.cacheSize ?? 100,
                    ttl: 3600,
                    strategy: "lru",
                },
            },
            this.logger,
        );

        this.registerBrushes();
        this.setupIPCHandlers();

        this.logger?.info("MaLiang服务初始化完成");
    }

    /**
     * 注册所有神笔
     */
    private registerBrushes(): void {
        const brushes = [
            new BmpBrush(),
            new MpegBrush(),
            // TODO: 添加其他神笔
        ];

        brushes.forEach((brush) => {
            this.maLiang.registerBrush(brush);
            this.logger?.debug(`注册神笔: ${brush.name}`);
        });

        this.logger?.info(`成功注册 ${brushes.length} 支神笔`);
    }

    /**
     * 设置IPC通信处理器
     */
    private setupIPCHandlers(): void {
        // 处理单个请求
        ipcMain.handle("ma-liang:process", async (_event, request: PaintRequest) => {
            return this.safeProcess(request);
        });

        // 批处理请求
        ipcMain.handle("ma-liang:batch", async (_event, requests: PaintRequest[]) => {
            return this.processBatch(requests);
        });

        // 获取统计信息
        ipcMain.handle("ma-liang:stats", async () => {
            return this.maLiang.getStatistics();
        });

        // 检查格式支持
        ipcMain.handle("ma-liang:check-support", async (_event, filePath: string) => {
            return this.maLiang.isSupported(filePath);
        });

        // 获取支持的格式列表
        ipcMain.handle("ma-liang:supported-formats", async () => {
            return this.getSupportedFormats();
        });

        this.logger?.info("IPC处理器设置完成");
    }

    /**
     * 安全处理请求
     * 包装错误处理，返回用户友好的结果
     */
    public async safeProcess(request: PaintRequest): Promise<SafeResult<PaintResult>> {
        const startTime = performance.now();

        try {
            this.logger?.debug(`开始处理: ${request.filePath}`);
            const result = await this.maLiang.paint(request);

            const duration = performance.now() - startTime;
            this.logger?.info(`处理成功: ${request.filePath} (${duration.toFixed(2)}ms)`);

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            const duration = performance.now() - startTime;
            this.logger?.error(`处理失败: ${request.filePath} (${duration.toFixed(2)}ms)`, error);

            return this.handleError(error as Error);
        }
    }

    /**
     * 批量处理
     */
    public async processBatch(requests: PaintRequest[]): Promise<BatchResult> {
        const startTime = performance.now();
        const results: Array<SafeResult<PaintResult>> = [];
        const concurrency = this.config.concurrency ?? 4;

        // 使用Promise.all处理，限制并发数
        const chunks = this.chunkArray(requests, concurrency);

        for (const chunk of chunks) {
            const chunkResults = await Promise.all(
                chunk.map((request) => this.safeProcess(request)),
            );
            results.push(...chunkResults);
        }

        const duration = performance.now() - startTime;
        const successful = results.filter((r) => r.success).length;
        const failed = results.length - successful;

        this.logger?.info(
            `批处理完成: 总计 ${results.length}, 成功 ${successful}, 失败 ${failed} (${duration.toFixed(
                2,
            )}ms)`,
        );

        return {
            total: results.length,
            successful,
            failed,
            results,
            duration,
        };
    }

    /**
     * 错误处理
     */
    private handleError(error: Error): SafeResult {
        if (error instanceof ValidationError) {
            return {
                success: false,
                error: "输入参数无效",
                errorCode: "VALIDATION_ERROR",
                details: (error as MaLiangError).context,
            };
        }

        if (error instanceof FormatError) {
            return {
                success: false,
                error: "文件格式不支持",
                errorCode: "FORMAT_ERROR",
                details: {
                    message: error.message,
                    supportedFormats: this.getSupportedFormats(),
                },
            };
        }

        // 其他Ma-Liang错误
        if ("code" in error) {
            const maLiangError = error as MaLiangError;
            return {
                success: false,
                error: maLiangError.message,
                errorCode: maLiangError.code,
                details: maLiangError.context,
            };
        }

        // 未知错误
        return {
            success: false,
            error: "处理失败，请稍后重试",
            errorCode: "UNKNOWN_ERROR",
            details: {
                message: error.message,
                stack: error.stack,
            },
        };
    }

    /**
     * 获取支持的格式列表
     */
    public getSupportedFormats(): string[] {
        const brushes = this.maLiang.listBrushes();
        const formats = new Set<string>();

        brushes.forEach((brush) => {
            brush.supportedFormats.forEach((format) => formats.add(format));
        });

        return Array.from(formats).sort();
    }

    /**
     * 获取引擎统计信息
     */
    public getStatistics() {
        return this.maLiang.getStatistics();
    }

    /**
     * 清理资源
     */
    public async cleanup(): Promise<void> {
        await this.maLiang.cleanup();
        this.logger?.info("MaLiang服务已清理");
    }

    /**
     * 数组分块
     */
    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}

/**
 * 导出便捷初始化函数
 */
export function initializeMaLiangService(
    config?: MaLiangServiceConfig,
    logger?: PhotasaLogger,
): MaLiangService {
    return MaLiangService.getInstance(config, logger);
}
