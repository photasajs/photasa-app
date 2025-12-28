/**
 * BrushRegistry - 神笔注册器
 * 管理所有神笔的注册、发现和选择
 */

import type { PhotasaLogger } from "@photasa/common";
import type { MagicBrush } from "./MagicBrush";
import type { BrushRegistration, PaintOperation } from "../types/BrushTypes";
import { FormatDetector, type DetectionResult } from "./FormatDetector";

/**
 * 神笔选择结果
 */
export interface BrushSelection {
    brush: MagicBrush;
    confidence: number;
    reason: string;
}

/**
 * 神笔注册器类
 * 负责管理神笔的生命周期和选择逻辑
 */
export class BrushRegistry {
    private brushes: Map<string, MagicBrush> = new Map();
    private formatCache: Map<string, DetectionResult> = new Map();
    private selectionCache: Map<string, BrushSelection> = new Map();

    constructor(private logger?: PhotasaLogger) {}

    /**
     * 注册神笔
     * @param brush 神笔实例
     */
    public registerBrush(brush: MagicBrush): void {
        const registration = brush.getRegistration();

        if (this.brushes.has(registration.name)) {
            this.logger?.warn(`Brush ${registration.name} already registered, replacing...`);
        }

        this.brushes.set(registration.name, brush);

        // 清除相关缓存
        this.clearCacheForBrush(registration);

        this.logger?.info(
            `Registered brush: ${registration.name} (supports: ${registration.supportedFormats.join(", ")}, priority: ${registration.priority})`,
        );
    }

    /**
     * 注销神笔
     * @param brushName 神笔名称
     */
    public unregisterBrush(brushName: string): boolean {
        const brush = this.brushes.get(brushName);
        if (!brush) {
            this.logger?.warn(`Brush ${brushName} not found for unregistration`);
            return false;
        }

        // 清理神笔资源
        if (brush.cleanup) {
            brush.cleanup(this.logger).catch((error) => {
                this.logger?.error(`Error cleaning up brush ${brushName}:`, error);
            });
        }

        this.brushes.delete(brushName);

        // 清除相关缓存
        const registration = brush.getRegistration();
        this.clearCacheForBrush(registration);

        this.logger?.info(`Unregistered brush: ${brushName}`);
        return true;
    }

    /**
     * 根据文件路径选择最佳神笔
     * @param filePath 文件路径
     * @param operation 所需操作（可选）
     * @returns Promise<BrushSelection | null>
     */
    public async selectBrush(
        filePath: string,
        operation?: PaintOperation,
    ): Promise<BrushSelection | null> {
        const cacheKey = `${filePath}:${operation || "any"}`;

        // 检查缓存
        if (this.selectionCache.has(cacheKey)) {
            const cached = this.selectionCache.get(cacheKey);
            if (cached) {
                this.logger?.debug(
                    `Cache hit for brush selection: ${filePath} -> ${cached.brush.name}`,
                );
                return cached;
            }
        }

        try {
            // 检测文件格式
            const detection = await this.detectFormat(filePath);

            // 查找支持该格式的神笔
            const candidates = this.findCandidateBrushes(detection.format, operation);

            if (candidates.length === 0) {
                // 尝试查找FallbackBrush作为最后的选择
                const fallbackCandidates = this.findCandidateBrushes("*", operation);
                if (fallbackCandidates.length > 0) {
                    this.logger?.info(
                        `No specific brush found for format: ${detection.format}, using fallback brush`,
                    );
                    const selection = this.selectBestBrush(fallbackCandidates, detection, filePath);
                    this.selectionCache.set(cacheKey, selection);
                    return selection;
                }

                this.logger?.warn(
                    `No brush found for format: ${detection.format}, operation: ${operation || "any"}`,
                );
                return null;
            }

            // 选择最佳神笔
            const selection = this.selectBestBrush(candidates, detection, filePath);

            // 缓存结果
            this.selectionCache.set(cacheKey, selection);

            this.logger?.debug(
                `Selected brush: ${selection.brush.name} for ${filePath} (${selection.reason})`,
            );
            return selection;
        } catch (error) {
            this.logger?.error(`Error selecting brush for ${filePath}:`, error);
            return null;
        }
    }

    /**
     * 检测文件格式（带缓存）
     */
    private async detectFormat(filePath: string): Promise<DetectionResult> {
        if (this.formatCache.has(filePath)) {
            const cached = this.formatCache.get(filePath);
            if (cached) {
                return cached;
            }
        }

        const detection = await FormatDetector.detect(filePath, this.logger);
        this.formatCache.set(filePath, detection);

        return detection;
    }

    /**
     * 查找候选神笔
     */
    private findCandidateBrushes(format: string, operation?: PaintOperation): MagicBrush[] {
        const candidates: MagicBrush[] = [];

        for (const brush of this.brushes.values()) {
            // 检查格式支持
            if (!brush.supportedFormats.includes(format)) {
                continue;
            }

            // 检查操作支持
            if (operation && !brush.canPerform(operation)) {
                continue;
            }

            candidates.push(brush);
        }

        return candidates;
    }

    /**
     * 选择最佳神笔
     */
    private selectBestBrush(
        candidates: MagicBrush[],
        detection: DetectionResult,
        _filePath: string,
    ): BrushSelection {
        // 按优先级排序
        const sorted = candidates.sort((a, b) => b.priority - a.priority);

        const bestBrush = sorted[0];
        const priority = bestBrush.priority;

        // 计算置信度
        let confidence = detection.confidence;

        // 如果有多个同优先级的神笔，选择更具体的
        const samePriorityBrushes = sorted.filter((b) => b.priority === priority);
        if (samePriorityBrushes.length > 1) {
            const mostSpecific = this.selectMostSpecific(samePriorityBrushes, detection.format);
            confidence = Math.min(confidence, 80); // 降低置信度

            return {
                brush: mostSpecific,
                confidence,
                reason: `Selected from ${samePriorityBrushes.length} candidates by specificity (priority: ${priority})`,
            };
        }

        return {
            brush: bestBrush,
            confidence,
            reason: `Best priority match (priority: ${priority})`,
        };
    }

    /**
     * 选择最具体的神笔（支持格式数量最少的）
     */
    private selectMostSpecific(brushes: MagicBrush[], format: string): MagicBrush {
        return brushes.reduce((best, current) => {
            // 优先选择支持格式更少的神笔（更专业）
            if (current.supportedFormats.length < best.supportedFormats.length) {
                return current;
            }

            // 如果格式数量相同，选择名称包含特定格式的
            if (current.supportedFormats.length === best.supportedFormats.length) {
                const currentIncludesFormat = current.name.toLowerCase().includes(format);
                const bestIncludesFormat = best.name.toLowerCase().includes(format);

                if (currentIncludesFormat && !bestIncludesFormat) {
                    return current;
                }
            }

            return best;
        });
    }

    /**
     * 获取所有注册的神笔
     */
    public getAllBrushes(): MagicBrush[] {
        return Array.from(this.brushes.values());
    }

    /**
     * 根据名称获取神笔
     */
    public getBrush(name: string): MagicBrush | undefined {
        return this.brushes.get(name);
    }

    /**
     * 获取神笔统计信息
     */
    public getStatistics(): {
        totalBrushes: number;
        supportedFormats: string[];
        brushesByFormat: Record<string, string[]>;
        averagePriority: number;
    } {
        const brushes = Array.from(this.brushes.values());
        const allFormats = new Set<string>();
        const brushesByFormat: Record<string, string[]> = {};
        let totalPriority = 0;

        for (const brush of brushes) {
            totalPriority += brush.priority;

            for (const format of brush.supportedFormats) {
                allFormats.add(format);

                if (!brushesByFormat[format]) {
                    brushesByFormat[format] = [];
                }
                brushesByFormat[format].push(brush.name);
            }
        }

        return {
            totalBrushes: brushes.length,
            supportedFormats: Array.from(allFormats),
            brushesByFormat,
            averagePriority: brushes.length > 0 ? totalPriority / brushes.length : 0,
        };
    }

    /**
     * 清除缓存
     */
    public clearCache(): void {
        this.formatCache.clear();
        this.selectionCache.clear();
        this.logger?.debug("Brush registry cache cleared");
    }

    /**
     * 清除特定神笔相关的缓存
     */
    private clearCacheForBrush(registration: BrushRegistration): void {
        // 清除格式缓存中相关的条目
        for (const [filePath, detection] of this.formatCache.entries()) {
            if (registration.supportedFormats.includes(detection.format)) {
                this.formatCache.delete(filePath);
            }
        }

        // 清除选择缓存中相关的条目
        for (const [key, selection] of this.selectionCache.entries()) {
            if (selection.brush.name === registration.name) {
                this.selectionCache.delete(key);
            }
        }
    }

    /**
     * 初始化所有神笔
     */
    public async initializeAll(config?: Record<string, any>): Promise<void> {
        const initPromises: Promise<void>[] = [];

        for (const brush of this.brushes.values()) {
            if (brush.initialize) {
                initPromises.push(
                    brush.initialize(config, this.logger).catch((error) => {
                        this.logger?.error(`Failed to initialize brush ${brush.name}:`, error);
                    }),
                );
            }
        }

        await Promise.all(initPromises);
        this.logger?.info(`Initialized ${initPromises.length} brushes`);
    }

    /**
     * 清理所有神笔
     */
    public async cleanupAll(): Promise<void> {
        const cleanupPromises: Promise<void>[] = [];

        for (const brush of this.brushes.values()) {
            if (brush.cleanup) {
                cleanupPromises.push(
                    brush.cleanup(this.logger).catch((error) => {
                        this.logger?.error(`Failed to cleanup brush ${brush.name}:`, error);
                    }),
                );
            }
        }

        await Promise.all(cleanupPromises);
        this.clearCache();
        this.logger?.info(`Cleaned up ${cleanupPromises.length} brushes`);
    }
}
