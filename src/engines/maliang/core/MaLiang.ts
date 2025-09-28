/**
 * MaLiang - 马良神笔主引擎
 * 统一的图像处理引擎，管理所有神笔并提供统一的处理接口
 */

import type { PhotasaLogger } from "@common/logger";
import type {
    PaintRequest,
    PaintResult,
    PaintOperation,
    MaLiangConfig,
    PerformanceMetrics,
} from "../types/BrushTypes";
import type { MagicBrush } from "./MagicBrush";
import { BrushRegistry } from "./BrushRegistry";
import { FormatDetector } from "./FormatDetector";
import { ErrorManager, ValidationError } from "./ErrorManager";

/**
 * Ma-Liang 主引擎类
 * 神笔工坊的管理者，负责调度所有神笔完成图像处理任务
 */
export class MaLiang {
    private registry: BrushRegistry;
    private config: MaLiangConfig;
    private performanceCache: Map<string, PerformanceMetrics> = new Map();
    private errorManager: ErrorManager;

    constructor(
        config: MaLiangConfig = {},
        private logger?: PhotasaLogger,
    ) {
        this.config = {
            debug: false,
            performance: {
                enableMonitoring: true,
                logSlowOperations: true,
                slowOperationThreshold: 5000, // 5 seconds
            },
            cache: {
                enabled: true,
                maxSize: 100, // 100MB
                ttl: 3600, // 1 hour
                strategy: "lru",
            },
            ...config,
        };

        this.registry = new BrushRegistry(this.logger);
        this.errorManager = new ErrorManager(this.logger);

        this.logger?.info("Ma-Liang engine initialized", this.config);
    }

    /**
     * 选择合适的神笔处理文件
     * @param filePath 文件路径
     * @param operation 所需操作
     * @returns MagicBrush | null
     */
    public async selectBrush(
        filePath: string,
        operation?: PaintOperation,
    ): Promise<MagicBrush | null> {
        const selection = await this.registry.selectBrush(filePath, operation);
        return selection?.brush || null;
    }

    /**
     * 神笔作画 - 核心处理方法
     * @param request 作画请求
     * @returns Promise<PaintResult>
     */
    public async paint(request: PaintRequest): Promise<PaintResult> {
        const startTime = performance.now();

        try {
            this.validatePaintRequest(request);

            // 检测文件格式
            const detection = await FormatDetector.detect(request.filePath, this.logger);

            if (this.config.debug) {
                this.logger?.debug(
                    `Processing file: ${request.filePath}, detected format: ${detection.format}`,
                );
            }

            // 处理每个操作
            const results: Partial<PaintResult["outputs"]> = {};
            let usedBrush: MagicBrush | null = null;

            for (const operation of request.operations) {
                const brush = await this.selectBrush(request.filePath, operation);

                if (!brush) {
                    throw new Error(
                        `No brush found for operation: ${operation} on format: ${detection.format}`,
                    );
                }

                usedBrush = brush;

                // 执行具体操作
                const operationResult = await this.executeOperation(
                    brush,
                    operation,
                    request,
                    startTime,
                );

                // 合并结果
                Object.assign(results, operationResult);
            }

            const endTime = performance.now();
            const performanceMetrics: PerformanceMetrics = {
                startTime,
                endTime,
                duration: endTime - startTime,
                brushName: usedBrush?.name || "unknown",
            };

            // 记录性能指标
            this.recordPerformance(request.filePath, performanceMetrics);

            const result: PaintResult = {
                success: true,
                outputs: results,
                brushUsed: usedBrush?.name || "unknown",
                performance: performanceMetrics,
            };

            if (this.config.debug) {
                this.logger?.debug(
                    `Paint completed in ${performanceMetrics.duration.toFixed(2)}ms`,
                    result,
                );
            }

            return result;
        } catch (error) {
            const endTime = performance.now();
            const errorPerformance: PerformanceMetrics = {
                startTime,
                endTime,
                duration: endTime - startTime,
                brushName: "error",
            };

            this.logger?.error(`Paint operation failed for ${request.filePath}:`, error);

            return {
                success: false,
                outputs: {},
                brushUsed: "error",
                performance: errorPerformance,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }

    /**
     * 执行具体操作
     */
    private async executeOperation(
        brush: MagicBrush,
        operation: PaintOperation,
        request: PaintRequest,
        _startTime: number,
    ): Promise<Partial<PaintResult["outputs"]>> {
        const operationStartTime = performance.now();

        try {
            switch (operation) {
                case "extractMetadata": {
                    if (!this.logger) {
                        throw new Error("Logger is required for extractMetadata operation");
                    }
                    const metadata = await brush.extractEssence(request.filePath, this.logger);
                    return { metadata: metadata || undefined };
                }

                case "generateThumbnail": {
                    if (!request.thumbnailOptions) {
                        throw new Error(
                            "Thumbnail options required for generateThumbnail operation",
                        );
                    }
                    if (!this.logger) {
                        throw new Error("Logger is required for generateThumbnail operation");
                    }
                    // 将outputPath传递给thumbnailOptions
                    const extendedOptions = {
                        ...request.thumbnailOptions,
                        outputPath: request.outputPath,
                    };

                    const thumbnail = await brush.createMiniature(
                        request.filePath,
                        extendedOptions,
                        this.logger,
                    );
                    return { thumbnail };
                }

                case "convertFormat": {
                    if (!brush.transform) {
                        throw new Error(`Brush ${brush.name} does not support format conversion`);
                    }
                    if (!request.outputPath) {
                        throw new Error("Output path required for convertFormat operation");
                    }
                    if (!this.logger) {
                        throw new Error("Logger is required for convertFormat operation");
                    }
                    const converted = await brush.transform(
                        request.filePath,
                        "auto", // TODO: 从request中获取目标格式
                        request.outputPath,
                        this.logger,
                    );
                    return { converted };
                }

                case "editImage": {
                    if (!brush.edit) {
                        throw new Error(`Brush ${brush.name} does not support image editing`);
                    }
                    if (!request.editOperations) {
                        throw new Error("Edit operations required for editImage operation");
                    }
                    if (!request.outputPath) {
                        throw new Error("Output path required for editImage operation");
                    }
                    if (!this.logger) {
                        throw new Error("Logger is required for editImage operation");
                    }
                    const edited = await brush.edit(
                        request.filePath,
                        request.editOperations,
                        request.outputPath,
                        this.logger,
                    );
                    return { edited };
                }

                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }
        } finally {
            const operationDuration = performance.now() - operationStartTime;

            if (
                this.config.performance?.logSlowOperations &&
                operationDuration > (this.config.performance.slowOperationThreshold || 5000)
            ) {
                this.logger?.warn(
                    `Slow operation detected: ${operation} took ${operationDuration.toFixed(2)}ms with brush ${brush.name}`,
                );
            }
        }
    }

    /**
     * 注册新神笔到工坊
     * @param brush 神笔实例
     */
    public registerBrush(brush: MagicBrush): void {
        this.registry.registerBrush(brush);
    }

    /**
     * 注销神笔
     * @param brushName 神笔名称
     */
    public unregisterBrush(brushName: string): boolean {
        return this.registry.unregisterBrush(brushName);
    }

    /**
     * 查看工坊里的所有神笔
     * @returns MagicBrush[]
     */
    public listBrushes(): MagicBrush[] {
        return this.registry.getAllBrushes();
    }

    /**
     * 检查格式支持
     * @param filePath 文件路径
     * @returns Promise<boolean>
     */
    public async isSupported(filePath: string): Promise<boolean> {
        try {
            const detection = await FormatDetector.detect(filePath, this.logger);
            const brush = await this.selectBrush(filePath);
            return brush !== null && detection.confidence > 50;
        } catch {
            return false;
        }
    }

    /**
     * 获取引擎统计信息
     */
    public getStatistics() {
        const brushStats = this.registry.getStatistics();
        const performanceStats = this.getPerformanceStatistics();
        const errorStats = this.errorManager.getStatistics();

        return {
            brushes: brushStats,
            performance: performanceStats,
            errors: errorStats,
            cache: {
                enabled: this.config.cache?.enabled || false,
                size: this.performanceCache.size,
            },
        };
    }

    /**
     * 初始化引擎
     * @param config 配置参数
     */
    public async initialize(config?: Record<string, any>): Promise<void> {
        await this.registry.initializeAll(config);
        this.logger?.info("Ma-Liang engine fully initialized");
    }

    /**
     * 清理引擎资源
     */
    public async cleanup(): Promise<void> {
        await this.registry.cleanupAll();
        this.performanceCache.clear();
        this.logger?.info("Ma-Liang engine cleaned up");
    }

    /**
     * 验证作画请求
     * @throws ValidationError 参数验证失败
     */
    private validatePaintRequest(request: PaintRequest): void {
        if (!request.filePath) {
            throw new ValidationError("File path is required", { request });
        }

        if (!request.operations || request.operations.length === 0) {
            throw new ValidationError("At least one operation is required", { request });
        }

        // 验证操作组合
        const hasConvert = request.operations.includes("convertFormat");
        const hasEdit = request.operations.includes("editImage");

        if ((hasConvert || hasEdit) && !request.outputPath) {
            throw new ValidationError(
                "Output path is required for convertFormat or editImage operations",
                {
                    request,
                    operations: [hasConvert && "convertFormat", hasEdit && "editImage"].filter(
                        Boolean,
                    ),
                },
            );
        }

        if (request.operations.includes("generateThumbnail") && !request.thumbnailOptions) {
            throw new ValidationError(
                "Thumbnail options are required for generateThumbnail operation",
                { request },
            );
        }

        if (hasEdit && (!request.editOperations || request.editOperations.length === 0)) {
            throw new ValidationError("Edit operations are required for editImage operation", {
                request,
            });
        }
    }

    /**
     * 记录性能指标
     */
    private recordPerformance(filePath: string, performanceData: PerformanceMetrics): void {
        if (!this.config.performance?.enableMonitoring) {
            return;
        }

        // 简单的LRU缓存
        if (this.performanceCache.size > 1000) {
            const firstKey = this.performanceCache.keys().next().value;
            if (firstKey !== undefined) {
                this.performanceCache.delete(firstKey);
            }
        }

        this.performanceCache.set(filePath, performanceData);
    }

    /**
     * 获取性能统计
     */
    private getPerformanceStatistics() {
        const metrics = Array.from(this.performanceCache.values());

        if (metrics.length === 0) {
            return {
                totalOperations: 0,
                averageDuration: 0,
                maxDuration: 0,
                minDuration: 0,
            };
        }

        const durations = metrics.map((m) => m.duration);
        const total = durations.reduce((sum, d) => sum + d, 0);

        return {
            totalOperations: metrics.length,
            averageDuration: total / metrics.length,
            maxDuration: Math.max(...durations),
            minDuration: Math.min(...durations),
        };
    }
}
