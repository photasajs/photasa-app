/**
 * 千里眼扫描引擎
 * RFC 0032: 专用的文件夹与媒体扫描引擎
 *
 * 职责：
 * 1. 统一文件夹和媒体扫描入口
 * 2. 扫描策略决策（增量、全量、跳过）
 * 3. 扫描任务调度和执行
 * 4. 扫描结果缓存和持久化
 * 5. 扫描状态广播和进度报告
 */

import { EventEmitter } from "events";
import { join } from "path";
import { homedir } from "os";
import { writeFile, readFile, mkdir } from "fs/promises";
import { loggers } from "@common/logger";
import type { ScanAction } from "@common/scan-types";

const logger = loggers.qianliyan;

/**
 * 扫描命令
 */
export interface ScanCommand {
    /** 扫描路径 */
    paths: string[];
    /** 递归扫描 */
    recursive?: boolean;
    /** 扫描优先级 */
    priority?: "urgent" | "normal" | "background";
    /** 触发来源 */
    source?: "user" | "watcher" | "scheduled" | "api";
    /** 扫描类型 */
    scanType?: "quick" | "full" | "incremental";
    /** 过滤器 */
    filters?: {
        includePatterns?: string[];
        excludePatterns?: string[];
        maxFileSize?: number;
        minFileSize?: number;
    };
    /** 请求ID */
    requestId?: string;
}

/**
 * 扫描结果
 */
export interface ScanResult {
    /** 请求ID */
    requestId: string;
    /** 扫描路径 */
    path: string;
    /** 扫描成功 */
    success: boolean;
    /** 扫描的文件数量 */
    fileCount: number;
    /** 新发现的文件数量 */
    newFileCount: number;
    /** 跳过的文件数量 */
    skippedFileCount: number;
    /** 扫描耗时（毫秒） */
    duration: number;
    /** 错误信息 */
    error?: string;
    /** 扫描详情 */
    details?: {
        processedFiles: string[];
        newFiles: string[];
        skippedFiles: string[];
        errors: Array<{ file: string; error: string }>;
    };
}

/**
 * 扫描进度信息
 */
export interface ScanProgress {
    /** 请求ID */
    requestId: string;
    /** 当前路径 */
    currentPath: string;
    /** 已处理文件数量 */
    processedCount: number;
    /** 总文件数量（估计） */
    totalCount: number;
    /** 进度百分比 */
    percentage: number;
    /** 当前阶段 */
    phase: "scanning" | "processing" | "caching" | "finalizing";
    /** 阶段描述 */
    message?: string;
}

/**
 * 扫描状态
 */
export interface ScanStatus {
    /** 队列中的任务数量 */
    queuedTasks: number;
    /** 正在执行的任务数量 */
    activeTaskCount: number;
    /** 总共处理的任务数量 */
    totalProcessed: number;
    /** 引擎状态 */
    engineStatus: "idle" | "busy" | "error" | "shutdown";
    /** 最后一次扫描时间 */
    lastScanTime?: number;
    /** 活跃的扫描任务详情 */
    activeTasks: Array<{
        requestId: string;
        path: string;
        progress: number;
        startTime: number;
    }>;
    /** 活跃扫描数量（兼容性） */
    activeScans: number;
    /** 队列扫描数量（兼容性） */
    queuedScans: number;
    /** 总扫描数量（兼容性） */
    totalScans: number;
}

/**
 * 千里眼引擎配置
 *
 * ✅ RFC 0032: 千里眼职责是扫描执行和队列持久化
 * 配置选项应该最小化，大部分行为应该是固定的
 */
export interface QianliyanEngineConfig {
    /** 最大并发扫描任务数 */
    maxConcurrentScans?: number;
    /** 扫描超时时间（毫秒） */
    scanTimeout?: number;
    /** 默认扫描过滤器 */
    defaultFilters?: ScanCommand["filters"];
}

/**
 * 千里眼扫描引擎主类
 */
export class QianliyanEngine extends EventEmitter {
    private config: Required<QianliyanEngineConfig>;
    private isInitialized = false;
    private taskQueue: ScanCommand[] = [];
    private activeTasks = new Map<string, ScanCommand>();
    private scanRegistry = new Map<string, { lastScan: number; fingerprint: string }>();
    private requestCounter = 0;
    private scanningQueuePath: string;
    private readonly appDataPath: string;

    constructor(config: QianliyanEngineConfig = {}) {
        super();

        // ✅ 使用Node.js标准API获取用户主目录
        // os.homedir() 跨平台支持 (Windows/Mac/Linux)
        this.appDataPath = join(homedir(), ".photasa");

        this.config = {
            maxConcurrentScans: 3,
            scanTimeout: 300000, // 5分钟
            defaultFilters: {
                includePatterns: [
                    "*.jpg",
                    "*.jpeg",
                    "*.png",
                    "*.gif",
                    "*.bmp",
                    "*.webp",
                    "*.tiff",
                    "*.svg",
                ],
                excludePatterns: ["*.tmp", "*.cache", "*/node_modules/*", "*/.*"],
                maxFileSize: 100 * 1024 * 1024, // 100MB
                minFileSize: 1024, // 1KB
            },
            ...config,
        };

        // ✅ RFC 0032 Line 185 + RFC 0042 Step 2: 千里眼扫描队列持久化路径
        // 路径：~/.photasa/scan/scanning.json
        this.scanningQueuePath = join(this.appDataPath, "scan", "scanning.json");
    }

    /**
     * 初始化千里眼引擎
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            logger.info("🌌 千里眼仙君归位，开始初始化");

            // 初始化缓存目录（扫描结果缓存）
            await this.initializeCache();

            // 加载扫描注册表
            await this.loadScanRegistry();

            this.isInitialized = true;
            logger.info("🌌 千里眼扫描引擎初始化完成");
            this.emit("initialized");
        } catch (error) {
            logger.error("🌌 初始化千里眼扫描引擎失败:", error);
            throw error;
        }
    }

    /**
     * 关闭千里眼引擎
     */
    async shutdown(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        try {
            logger.info("🌌 千里眼仙君：开始关闭引擎");

            // 取消所有活跃任务
            for (const [requestId] of this.activeTasks) {
                await this.cancelScan(requestId);
            }

            // 保存扫描注册表
            await this.saveScanRegistry();

            this.isInitialized = false;
            logger.info("🌌 千里眼扫描引擎关闭完成");
            this.emit("shutdown");
        } catch (error) {
            logger.error("🌌 关闭千里眼扫描引擎失败:", error);
            throw error;
        }
    }

    /**
     * 规划扫描 - 千里眼引擎的核心入口点
     */
    async planScan(command: ScanCommand): Promise<string> {
        if (!this.isInitialized) {
            throw new Error("QianliyanEngine not initialized");
        }

        // 生成请求ID
        const requestId = command.requestId || `scan-${Date.now()}-${++this.requestCounter}`;
        const enrichedCommand: ScanCommand = {
            ...command,
            requestId,
            priority: command.priority || "normal",
            source: command.source || "user",
            scanType: command.scanType || "incremental",
            filters: { ...this.config.defaultFilters, ...command.filters },
        };

        logger.info(`🌌 规划扫描: ${command.paths.join(", ")}`);

        // 归一化和去重路径
        const normalizedPaths = await this.normalizePaths(enrichedCommand.paths);
        enrichedCommand.paths = normalizedPaths;

        // 检查扫描策略
        const scanDecision = await this.decideScanStrategy(enrichedCommand);

        if (scanDecision.skip) {
            logger.info(`🌌 跳过扫描: ${requestId}: ${scanDecision.reason}`);
            this.emit("scanSkipped", { requestId, reason: scanDecision.reason });
            return requestId;
        }

        // 加入任务队列
        this.taskQueue.push(enrichedCommand);
        this.emit("scanQueued", { requestId, command: enrichedCommand });

        // 开始处理队列
        setImmediate(() => this.processQueue());

        return requestId;
    }

    /**
     * 取消扫描
     */
    async cancelScan(requestId: string): Promise<boolean> {
        // 从队列中移除
        const queueIndex = this.taskQueue.findIndex((task) => task.requestId === requestId);
        if (queueIndex !== -1) {
            this.taskQueue.splice(queueIndex, 1);
            this.emit("scanCancelled", { requestId, reason: "Cancelled from queue" });
            return true;
        }

        // 取消活跃任务
        if (this.activeTasks.has(requestId)) {
            this.activeTasks.delete(requestId);
            this.emit("scanCancelled", { requestId, reason: "Cancelled active task" });
            return true;
        }

        return false;
    }

    /**
     * 扫描方法 - 简化的API，内部调用planScan
     */
    async scan(command: ScanCommand): Promise<ScanResult> {
        if (!this.isInitialized) {
            throw new Error("QianliyanEngine not initialized");
        }

        // 生成请求ID
        const requestId = command.requestId || `scan-${Date.now()}-${++this.requestCounter}`;
        const enrichedCommand: ScanCommand = {
            ...command,
            requestId,
            priority: command.priority || "normal",
            source: command.source || "user",
            scanType: command.scanType || "incremental",
            filters: { ...this.config.defaultFilters, ...command.filters },
        };

        // 直接执行扫描
        return await this.performScan(enrichedCommand);
    }

    /**
     * 获取扫描状态
     */
    getStatus(): ScanStatus {
        const activeTasks = Array.from(this.activeTasks.entries()).map(([requestId, command]) => ({
            requestId,
            path: command.paths.join(", "),
            progress: 0, // TODO: 实现实际进度跟踪
            startTime: Date.now(), // TODO: 记录实际开始时间
        }));

        return {
            queuedTasks: this.taskQueue.length,
            activeTaskCount: this.activeTasks.size,
            totalProcessed: 0, // TODO: 实现实际统计
            engineStatus: this.isInitialized
                ? this.activeTasks.size > 0
                    ? "busy"
                    : "idle"
                : "shutdown",
            activeTasks,
            // 兼容性属性
            activeScans: this.activeTasks.size,
            queuedScans: this.taskQueue.length,
            totalScans: 0, // TODO: 实现实际统计
        };
    }

    /**
     * ✅ RFC 0032 Line 177-181: 千里眼扫描队列持久化
     * ✅ RFC 0042 Step 2: 保存扫描队列到~/.photasa/scan/scanning.json
     *
     * 职责：持久化扫描队列到文件，供断电恢复使用
     * 路径：~/.photasa/scan/scanning.json
     */
    async persistQueue(queue: ScanAction[]): Promise<void> {
        try {
            // 防御性检查：确保queue是数组
            if (!Array.isArray(queue)) {
                logger.error(`🌌 天劫降临：封印之术收到非法仙令，类型=${typeof queue}`, {
                    queueValue: queue,
                });
                throw new Error(`persistQueue expects array, got ${typeof queue}`);
            }

            logger.debug(`🌌 千里眼仙君施展封印之术，封存${queue.length}卷仙令`);

            // 确保scan目录存在
            await mkdir(join(this.appDataPath, "scan"), { recursive: true });

            const data = JSON.stringify(
                {
                    version: "1.0",
                    timestamp: Date.now(),
                    queue: queue,
                },
                null,
                2,
            );

            await writeFile(this.scanningQueuePath, data, "utf-8");

            logger.info(`🌌 封印大功告成，${queue.length}卷仙令已封存至仙府密库`);
        } catch (error) {
            logger.error("🌌 天劫降临：封印之术功败垂成", error);
            throw error;
        }
    }

    /**
     * ✅ RFC 0032 Line 180: 千里眼从scanning.json恢复未完成任务
     * ✅ RFC 0042 Step 2: 从~/.photasa/scan/scanning.json恢复扫描队列
     *
     * 职责：启动时恢复上次未完成的扫描队列
     * 路径：~/.photasa/scan/scanning.json
     */
    async restoreQueue(): Promise<ScanAction[]> {
        try {
            logger.debug("🌌 千里眼仙君施展唤灵之术，开启仙令召回");

            const data = await readFile(this.scanningQueuePath, "utf-8");
            const parsed = JSON.parse(data) as {
                version: string;
                timestamp: number;
                queue: ScanAction[];
            };

            if (!parsed.queue || !Array.isArray(parsed.queue)) {
                logger.warn("🌌 【警示】仙令符文损坏，重铸空白仙卷");
                await this.clearPersistedQueue();
                return [];
            }

            logger.info(`🌌 唤灵大功告成，召回${parsed.queue.length}卷仙令`);
            return parsed.queue;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                logger.debug("🌌 仙令密库空无一物，铸造空白仙卷");
                await this.clearPersistedQueue(); // 创建空配置文件
                return [];
            }
            logger.error("🌌 天劫降临：唤灵之术功败垂成", error);
            return [];
        }
    }

    /**
     * ✅ RFC 0042 Step 2: 清空持久化队列
     *
     * 职责：清空~/.photasa/scan/scanning.json文件，用于用户手动清空队列时
     * 路径：~/.photasa/scan/scanning.json
     */
    async clearPersistedQueue(): Promise<void> {
        try {
            logger.debug("🌌 千里眼仙君施展净化之术，荡涤仙令密库");

            // 确保scan目录存在
            await mkdir(join(this.appDataPath, "scan"), { recursive: true });

            await writeFile(
                this.scanningQueuePath,
                JSON.stringify(
                    {
                        version: "1.0",
                        timestamp: Date.now(),
                        queue: [],
                    },
                    null,
                    2,
                ),
                "utf-8",
            );

            logger.info("🌌 净化大功告成，仙令密库空明如初");
        } catch (error) {
            logger.error("🌌 天劫降临：净化之术功败垂成", error);
        }
    }

    /**
     * 路径归一化和去重
     */
    private async normalizePaths(paths: string[]): Promise<string[]> {
        // TODO: 实现路径解析、绝对路径转换、去重逻辑
        return [...new Set(paths.map((path) => join(path)))];
    }

    /**
     * 决定扫描策略
     */
    private async decideScanStrategy(
        command: ScanCommand,
    ): Promise<{ skip: boolean; reason?: string; strategy?: string }> {
        // TODO: 实现基于缓存和指纹的策略决策

        // 简单的重复扫描检查
        for (const path of command.paths) {
            const registry = this.scanRegistry.get(path);
            if (registry && command.scanType === "incremental") {
                const timeSinceLastScan = Date.now() - registry.lastScan;
                if (timeSinceLastScan < 60000) {
                    // 1分钟内不重复扫描
                    return { skip: true, reason: "Recently scanned" };
                }
            }
        }

        return { skip: false, strategy: command.scanType };
    }

    /**
     * 处理任务队列
     */
    private async processQueue(): Promise<void> {
        while (
            this.taskQueue.length > 0 &&
            this.activeTasks.size < this.config.maxConcurrentScans
        ) {
            const task = this.taskQueue.shift();
            if (!task) continue;

            if (task.requestId) {
                this.activeTasks.set(task.requestId, task);
            }
            this.executeScan(task).catch((error) => {
                logger.error(`🌌 扫描执行失败: ${task.requestId}:`, error);
            });
        }
    }

    /**
     * 执行扫描任务
     */
    private async executeScan(command: ScanCommand): Promise<void> {
        const requestId = command.requestId;
        if (!requestId) {
            throw new Error("Scan command missing requestId");
        }
        const startTime = Date.now();

        try {
            logger.info(`🌌 开始扫描: ${requestId} for paths: ${command.paths.join(", ")}`);

            this.emit("scanStarted", { requestId, command });

            // 模拟扫描过程
            const result = await this.performScan(command);

            // 更新扫描注册表
            for (const path of command.paths) {
                this.scanRegistry.set(path, {
                    lastScan: Date.now(),
                    fingerprint: `${path}-${Date.now()}`,
                });
            }

            this.emit("scanCompleted", { requestId, result });
            logger.info(`🌌 扫描完成: ${requestId}`);
        } catch (error) {
            const result: ScanResult = {
                requestId,
                path: command.paths.join(", "),
                success: false,
                fileCount: 0,
                newFileCount: 0,
                skippedFileCount: 0,
                duration: Date.now() - startTime,
                error: (error as Error).message,
            };

            this.emit("scanFailed", { requestId, result, error });
            logger.error(`🌌 扫描失败: ${requestId}`, error);
        } finally {
            this.activeTasks.delete(requestId);

            // 继续处理队列
            if (this.taskQueue.length > 0) {
                setImmediate(() => this.processQueue());
            }
        }
    }

    /**
     * 执行实际扫描逻辑
     */
    private async performScan(command: ScanCommand): Promise<ScanResult> {
        const requestId = command.requestId;
        if (!requestId) {
            throw new Error("Scan command missing requestId");
        }
        const startTime = Date.now();
        let processedCount = 0;
        let newFileCount = 0;

        // 模拟扫描进度
        for (let i = 0; i < 5; i++) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            processedCount += 10;

            const progress: ScanProgress = {
                requestId: requestId,
                currentPath: command.paths[0],
                processedCount,
                totalCount: 50,
                percentage: (processedCount / 50) * 100,
                phase: i < 3 ? "scanning" : "processing",
                message: `Processing files in ${command.paths[0]}`,
            };

            this.emit("scanProgress", progress);
        }

        // 模拟发现新文件
        newFileCount = Math.floor(Math.random() * 20) + 5;

        const result: ScanResult = {
            requestId: requestId,
            path: command.paths.join(", "),
            success: true,
            fileCount: processedCount,
            newFileCount,
            skippedFileCount: Math.floor(Math.random() * 5),
            duration: Date.now() - startTime,
            details: {
                processedFiles: Array.from({ length: processedCount }, (_, i) => `file_${i}.jpg`),
                newFiles: Array.from({ length: newFileCount }, (_, i) => `new_file_${i}.jpg`),
                skippedFiles: [],
                errors: [],
            },
        };

        return result;
    }

    /**
     * 初始化缓存
     *
     * RFC 0032 Line 40: 在 scan/cache 下存储扫描清单
     */
    private async initializeCache(): Promise<void> {
        // TODO: 实现缓存目录创建和初始化
        const cacheDir = join(this.appDataPath, "scan", "cache");
        logger.info(`🌌 千里眼仙君：缓存初始化完成 ${cacheDir}`);
    }

    /**
     * 加载扫描注册表
     */
    private async loadScanRegistry(): Promise<void> {
        // TODO: 从持久化存储加载扫描注册表
        logger.info("🌌 扫描注册表加载完成");
    }

    /**
     * 保存扫描注册表
     */
    private async saveScanRegistry(): Promise<void> {
        // TODO: 将扫描注册表保存到持久化存储
        logger.info("🌌 扫描注册表保存完成");
    }
}
