/**
 * Tianshu编排引擎主类
 * 负责用户意图理解、工作流编排、决策调度和状态管理
 */

import { EventEmitter } from "events";
import {
    UICommand,
    TianshuResponse,
    ProgressUpdate,
    UserIntent,
    TianshuError,
} from "../types/commands";
import { WorkflowDefinition, ExecutionContext, WorkflowExecutionOptions } from "../types/workflows";
import { SystemStatusReport, EngineStatus } from "../types/responses";
import * as fs from "fs";
import * as path from "path";
// import { WorkflowLoader } from "./WorkflowLoader";
import { VariableResolver, WorkflowOrchestrator, NodeWorkflowLoader } from "../orchestration";

// import {
//     WorkflowOrchestrator,
//     VariableResolver,
//     // type IWorkflowOrchestrator,
// } from "@zouwu-wf/workflow/runtime";
import { IStepExecutor } from "../common/interfaces";
// import { loggers } from "@common/logger";
import { IntentToWorkflowMap } from "./intent";
import { createLogger, LogLevel } from "@systembug/diting";

/**
 * Tianshu引擎配置
 */
export interface TianshuEngineConfig {
    /** 工作流目录路径 */
    workflowDir: string;
    /** 最大并发工作流数 */
    maxConcurrentWorkflows?: number;
    /** 默认超时时间（毫秒） */
    defaultTimeout?: number;
    /** 是否启用热重载 */
    enableHotReload?: boolean;
    /** 日志级别 */
    logLevel?: "debug" | "info" | "warn" | "error";
    /** 自定义变量 */
    globalVariables?: Record<string, unknown>;
    /** 步骤执行器 */
    stepExecutor: IStepExecutor;
}

/**
 * Tianshu编排引擎
 */
export class TianshuEngine extends EventEmitter {
    private config: TianshuEngineConfig;
    private workflowLoader: NodeWorkflowLoader;
    private orchestrator: WorkflowOrchestrator;
    private variableResolver: VariableResolver;
    private isInitialized = false;
    private activeExecutions = new Map<string, ExecutionContext>();
    private commandQueue: UICommand[] = [];

    private isProcessing = false;
    private logger = createLogger({ context: "tianshu" });

    private workflowMap = new Map<string, WorkflowDefinition>();

    constructor(config: TianshuEngineConfig) {
        super();
        this.config = {
            maxConcurrentWorkflows: 10,
            defaultTimeout: 600000, // 10分钟默认超时
            enableHotReload: false,
            logLevel: "info",
            globalVariables: {},
            ...config,
        };

        // Initialize dedicated logger for Zouwu components
        const zouwuLogger = createLogger({
            level: (this.config.logLevel as unknown as LogLevel) || LogLevel.INFO,
        });

        // Initialize NodeWorkflowLoader
        this.workflowLoader = new NodeWorkflowLoader(zouwuLogger);

        // Bridge Zouwu logger to Tianshu logger if needed, for now using console default or we can implement a bridge.
        // For simplicity, let's use the default createLogger which uses ConsoleTransport.

        this.variableResolver = new VariableResolver({
            globalVariables: this.config.globalVariables || {},
            logger: zouwuLogger,
        });

        this.orchestrator = new WorkflowOrchestrator({
            variableResolver: this.variableResolver,
            maxConcurrency: this.config.maxConcurrentWorkflows || 10,
            defaultTimeout: this.config.defaultTimeout || 30000,
            stepExecutor: this.config.stepExecutor,
            logger: zouwuLogger,
        });

        this.setupEventHandlers();
    }

    /**
     * 初始化引擎
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            this.logger.info("🌌 初始化天枢引擎");

            // 初始化工作流加载器 - 扫描所有工作流
            this.logger.info(`🌌 扫描工作流目录: ${this.config.workflowDir}`);
            const workflows = await this.workflowLoader.loadFromDirectory(
                this.config.workflowDir,
                true,
            );

            this.workflowMap.clear();
            for (const workflow of workflows) {
                // Cast to WorkflowDefinition (assuming compatibility or use adapter)
                const def = workflow as unknown as WorkflowDefinition;
                if (def.id) {
                    this.workflowMap.set(def.id, def);
                } else {
                    this.logger.warn(
                        `Loaded workflow has no ID: ${JSON.stringify(workflow).substring(0, 100)}...`,
                    );
                }
            }
            this.logger.info(
                `🌌 加载了 ${this.workflowMap.size} 个工作流: ${Array.from(this.workflowMap.keys()).join(", ")}`,
            );

            // 初始化编排器
            await this.orchestrator.initialize();

            this.isInitialized = true;
            this.logger.info("🌌 天枢引擎初始化成功");

            this.emit("initialized");
        } catch (error) {
            this.logger.error("🌌 初始化天枢引擎失败", error);
            throw new Error(`Tianshu engine initialization failed: ${(error as Error).message}`);
        }
    }

    // ... (processCommand and others remain similar until selectWorkflow)

    // Note: I need to preserve processCommand and others.
    // Since replace_file_content replaces a block, I should be careful.
    // I will target initialize and add workflowMap property.
    // And then separately target selectWorkflow.

    /**
     * 处理UI命令
     */
    async processCommand(command: UICommand): Promise<TianshuResponse> {
        if (!this.isInitialized) {
            throw new Error("Tianshu engine not initialized");
        }

        this.logger.info(`🌌 处理命令: ${command.intent} [${command.id}]`);

        try {
            // 创建响应对象
            const response: TianshuResponse = {
                commandId: command.id,
                intent: command.intent,
                status: "accepted",
                timestamp: Date.now(),
            };

            // 根据意图选择工作流
            this.logger.info("🌌 根据意图选择工作流", command.intent);
            const workflow = await this.selectWorkflow(command);
            if (!workflow) {
                response.status = "failed";
                response.error = this.createError(
                    "WORKFLOW_NOT_FOUND",
                    `No workflow found for intent: ${command.intent}`,
                );
                this.logger.error(`🌌 没有找到工作流: ${command.intent} [${command.id}]`);
                return response;
            }

            // 添加到队列
            this.logger.info("🌌 添加到队列", command.intent);
            this.commandQueue.push(command);
            response.status = "queued";

            // 开始处理队列
            this.processQueue();

            return response;
        } catch (error) {
            this.logger.error(`🌌 处理命令失败: ${command.intent} [${command.id}]`, error);
            return {
                commandId: command.id,
                intent: command.intent,
                status: "failed",
                error: this.createError("COMMAND_PROCESSING_FAILED", (error as Error).message),
                timestamp: Date.now(),
            };
        }
    }

    /**
     * 获取系统状态报告
     */
    async getSystemStatus(): Promise<SystemStatusReport> {
        const engines: EngineStatus[] = [
            {
                name: "tianshu",
                status: this.isInitialized ? "healthy" : "unhealthy",
                lastCheck: Date.now(),
                responseTime: 0,
            },
        ];

        this.logger.info("🌌 获取系统状态", { engines });

        const workflows = Array.from(this.activeExecutions.values()).map((execution) => ({
            workflowId: execution.workflowId,
            executionId: execution.executionId,
            status: execution.status as
                | "pending"
                | "running"
                | "completed"
                | "failed"
                | "cancelled",
            currentStep: execution.currentStepId,
            progress: this.calculateProgress(execution),
            startTime: execution.startTime,
            error: execution.error,
        }));

        return {
            overallStatus: this.isInitialized ? "healthy" : "unhealthy",
            timestamp: Date.now(),
            engines,
            workflows,
            systemMetrics: {
                cpuUsage: process.cpuUsage().user / 1000000,
                memoryUsage: process.memoryUsage().heapUsed,
                diskUsage: 0, // 需要实现磁盘使用量检测
                activeConnections: this.activeExecutions.size,
            },
            errorStats: {
                totalErrors: 0, // 需要实现错误统计
                recentErrors: 0,
                errorTypes: {},
            },
        };
    }

    /**
     * 取消命令执行
     */
    async cancelCommand(commandId: string): Promise<boolean> {
        const execution = this.activeExecutions.get(commandId);
        if (!execution) {
            return false;
        }

        this.logger.info("🌌 取消命令执行", { commandId });

        // Zouwu Orchestrator cancelExecution takes executionId.
        // In TianshuEngine, activeExecutions is keyed by commandId.
        // We need executionId from the context.
        if (execution.executionId) {
            await this.orchestrator.cancelExecution(execution.executionId);
        }

        execution.status = "cancelled";
        this.activeExecutions.delete(commandId);

        this.emit("commandCancelled", { commandId });

        return true;
    }

    // ========== Service Adapter Layer ==========
    // 以下方法为tianshu-service.ts提供兼容接口

    /**
     * 处理偏好获取请求 (Service Adapter)
     */
    async handlePreferenceGet(): Promise<unknown> {
        this.logger.info("🌌 处理偏好获取请求");

        const command: UICommand = {
            id: `pref-get-${Date.now()}`,
            intent: "get_status", // 使用现有意图类型
            params: { type: "preference" },
            priority: "system",
            createdAt: Date.now(),
            context: { source: "api" },
        };

        const response = await this.processCommand(command);
        if (response.status === "failed") {
            throw new Error(response.error?.message || "Failed to get preferences");
        }

        // 返回默认偏好结构
        return {
            revision: 1,
            ui: { theme: "light", layout: "grid" },
            display: { thumbnailSize: 200, sortOrder: "name" },
            scanning: { autoScan: true, excludePatterns: [] },
        };
    }

    /**
     * 处理偏好更新请求 (Service Adapter)
     */
    async handlePreferenceUpdate(delta: unknown): Promise<number> {
        this.logger.info("🌌 处理偏好更新请求", { delta });

        const command: UICommand = {
            id: `pref-update-${Date.now()}`,
            intent: "update_config",
            params: { delta },
            priority: "user",
            createdAt: Date.now(),
            context: { source: "api" },
        };

        const response = await this.processCommand(command);
        if (response.status === "failed") {
            throw new Error(response.error?.message || "Failed to update preferences");
        }

        // 触发偏好变更事件
        this.emit("preferenceChanged", {
            delta,
            revision: 2,
            timestamp: Date.now(),
        });

        return 2; // 返回新版本号
    }

    /**
     * 处理偏好重置请求 (Service Adapter)
     */
    async handlePreferenceReset(): Promise<unknown> {
        this.logger.info("🌌 处理偏好重置请求");

        const command: UICommand = {
            id: `pref-reset-${Date.now()}`,
            intent: "update_config",
            params: { action: "reset" },
            priority: "user",
            createdAt: Date.now(),
            context: { source: "api" },
        };

        const response = await this.processCommand(command);
        if (response.status === "failed") {
            throw new Error(response.error?.message || "Failed to reset preferences");
        }

        const defaultPreferences = {
            revision: 1,
            ui: { theme: "light", layout: "grid" },
            display: { thumbnailSize: 200, sortOrder: "name" },
            scanning: { autoScan: true, excludePatterns: [] },
        };

        this.emit("preferenceChanged", {
            type: "reset",
            preferences: defaultPreferences,
            timestamp: Date.now(),
        });

        return defaultPreferences;
    }

    /**
     * 处理偏好导入请求 (Service Adapter)
     */
    async handlePreferenceImport(preferences: unknown): Promise<unknown> {
        const command: UICommand = {
            id: `pref-import-${Date.now()}`,
            intent: "update_config",
            params: { action: "import", preferences },
            priority: "user",
            createdAt: Date.now(),
            context: { source: "api" },
        };

        const response = await this.processCommand(command);
        if (response.status === "failed") {
            throw new Error(response.error?.message || "Failed to import preferences");
        }

        this.emit("preferenceChanged", {
            type: "import",
            preferences,
            timestamp: Date.now(),
        });

        return preferences;
    }

    /**
     * 处理扫描意图请求 (Service Adapter)
     */
    async handleScanIntent(scanIntent: Record<string, any>): Promise<unknown> {
        const command: UICommand = {
            id: `scan-${Date.now()}`,
            intent: "scan_folder", // 根据scanIntent.type选择合适的意图
            params: {
                paths: scanIntent.paths,
                recursive: scanIntent.recursive,
                priority: scanIntent.priority,
                filters: scanIntent.filters,
                type: scanIntent.type,
            },
            priority: scanIntent.priority || "background",
            createdAt: Date.now(),
            context: { source: "api" },
        };

        // 监听进度事件并转发
        const progressHandler = (update: any) => {
            this.emit("scanProgress", {
                phase: update.phase || "processing",
                progress: update.progress || 0,
                message: update.message || "Processing...",
            });
        };

        this.on("progressUpdate", progressHandler);

        try {
            const response = await this.processCommand(command);

            if (response.status === "failed") {
                throw new Error(response.error?.message || "Scan intent failed");
            }

            return {
                success: true,
                data: {
                    scannedPaths: scanIntent.paths,
                    filesProcessed: 0, // TODO: 从实际结果获取
                    type: scanIntent.type,
                },
                duration: 0, // TODO: 计算实际耗时
            };
        } finally {
            this.off("progressUpdate", progressHandler);
        }
    }

    /**
     * 关闭引擎 (Service Adapter)
     */
    async shutdown(): Promise<void> {
        await this.cleanup();
    }

    // ========== End Service Adapter Layer ==========

    /**
     * 清理资源
     */
    async cleanup(): Promise<void> {
        this.logger.info("🌌 清理天枢引擎");

        // 取消所有活跃执行
        for (const [commandId] of Array.from(this.activeExecutions.entries())) {
            await this.cancelCommand(commandId);
        }

        // 清理组件
        await this.orchestrator.cleanup();
        // workflowLoader in Zouwu usually doesn't need cleanup unless it has watchers
        // NodeWorkflowLoader currently doesn't implement cleanup
        /*
        if (
            "cleanup" in this.workflowLoader &&
            typeof (this.workflowLoader as { cleanup?: () => Promise<void> }).cleanup === "function"
        ) {
            await (this.workflowLoader as { cleanup: () => Promise<void> }).cleanup();
        }
        */

        // VariableResolver cleanup
        if (
            "cleanup" in this.variableResolver &&
            typeof (this.variableResolver as any).cleanup === "function"
        ) {
            await (this.variableResolver as any).cleanup();
        }

        this.isInitialized = false;
        this.emit("cleaned");
        this.logger.info("🌌 天枢引擎清理完成");
    }

    /**
     * 设置事件处理器
     */
    private setupEventHandlers(): void {
        this.orchestrator.on("workflowStarted", (execution: ExecutionContext) => {
            if (execution.commandId) {
                this.activeExecutions.set(execution.commandId, execution);
            }
            this.emit("workflowStarted", execution);
        });

        this.orchestrator.on("workflowCompleted", (execution: ExecutionContext) => {
            if (execution.commandId) {
                this.activeExecutions.delete(execution.commandId);
            }
            this.emit("workflowCompleted", execution);
        });

        this.orchestrator.on("workflowFailed", (execution: ExecutionContext) => {
            if (execution.commandId) {
                this.activeExecutions.delete(execution.commandId);
            }
            this.emit("workflowFailed", execution);
        });

        this.orchestrator.on("stepProgress", (update: ProgressUpdate) => {
            this.emit("progressUpdate", update);
        });
    }

    /**
     * 选择工作流
     */
    private async selectWorkflow(command: UICommand): Promise<WorkflowDefinition | null> {
        const workflowId = this.getWorkflowIdForIntent(command.intent);

        // Check in memory map first (populated during init)
        if (this.workflowMap.has(workflowId)) {
            this.logger.info(`🌌 Found workflow in map: ${workflowId}`);
            return this.workflowMap.get(workflowId) || null;
        }

        // Fallback to legacy file check (for backward compatibility or if map missed it)
        const extensions = [".json", ".yaml", ".yml"];
        for (const ext of extensions) {
            const filePath = path.join(this.config.workflowDir, workflowId + ext);
            if (fs.existsSync(filePath)) {
                try {
                    const data = await this.workflowLoader.load(filePath);
                    // Convert WorkflowData to WorkflowDefinition if needed (Zouwu types might match)
                    return data as unknown as WorkflowDefinition;
                } catch (e) {
                    this.logger.error(`Failed to load workflow ${filePath}:`, e);
                }
            }
        }

        this.logger.warn(
            `Workflow file not found for ID: ${workflowId} in ${this.config.workflowDir}`,
        );
        return null;
    }

    /**
     * 根据意图获取工作流ID
     */
    private getWorkflowIdForIntent(intent: UserIntent): string {
        return IntentToWorkflowMap[intent] || "system/default";
    }

    /**
     * 处理命令队列
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.commandQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.commandQueue.length > 0) {
            const command = this.commandQueue.shift();
            if (!command) continue;
            await this.executeCommand(command);
        }

        this.isProcessing = false;
    }

    /**
     * 执行命令
     */
    private async executeCommand(command: UICommand): Promise<void> {
        try {
            const workflow = await this.selectWorkflow(command);
            if (!workflow) {
                this.logger.error(`🌌 没有找到工作流: ${command.intent} [${command.id}]`);
                throw new Error(`No workflow found for intent: ${command.intent}`);
            }

            const options: WorkflowExecutionOptions = {
                // async: true, // Zouwu might not use this flag in execution options exactly like Tianshu did, checking...
                // Zouwu options: { variables: ... } mostly.
                variables: {
                    ...command.params,
                    ...command.context?.metadata,
                },
            };

            await this.orchestrator.executeWorkflow(workflow, command, options);
        } catch (error) {
            this.logger.error("执行命令失败:", error);
            this.emit("commandFailed", { command, error });
        }
    }

    /**
     * 计算执行进度
     */
    private calculateProgress(execution: ExecutionContext): number {
        if (execution.metrics.stepCount === 0) {
            return 0;
        }
        return (
            ((execution.metrics.successStepCount + execution.metrics.failedStepCount) /
                execution.metrics.stepCount) *
            100
        );
    }

    /**
     * 创建错误对象
     */
    private createError(code: string, message: string, details?: any): TianshuError {
        return {
            code,
            message,
            details,
            retryable: false,
            suggestion: "Please check the command parameters and try again",
        };
    }
}
