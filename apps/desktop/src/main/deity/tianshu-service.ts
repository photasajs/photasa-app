/**
 * 天枢服务 - 天枢星君化身
 * 作为天庭编排神祇，掌管工作流编排，协调诸天引擎，处理用户意图
 *
 * 神话背景：
 * 天枢星君，北斗七星之首，乃紫微大帝座下重要星君
 * 掌管天庭工作流程编排，协调诸天万界的事务流转
 * 以智慧著称，善于理解用户意图，制定最优执行方案
 * 负责将复杂任务分解为可执行的步骤，确保天庭高效运转
 *
 * 核心能力：
 * - 意图理解：解析用户需求，转化为可执行的工作流
 * - 流程编排：将复杂任务分解为有序的执行步骤
 * - 协调调度：统筹各引擎资源，优化执行效率
 * - 状态管理：监控执行过程，确保任务顺利完成
 */

import { type IpcMain, BrowserWindow, app } from "electron";
import path from "path";
import { Service } from "@main/tianting/decorators/service-decorators";
import { ServicePriority, IService } from "@main/tianting/core/service-types";
import { TianshuEngine } from "@photasa/tianshu";
import { loggers } from "@photasa/common";
import type TaiyiService from "./taiyi-service";
import { IStepExecutor } from "@engines/common/interfaces";

const logger = loggers.tianshu || loggers.main;

/**
 * 获取工作流目录
 * 根据环境确定工作流目录
 * 在生产环境中，工作流目录在 resources/workflows（通过 extraResources 复制）
 * 在开发环境中，工作流目录在源代码位置
 */
function getWorkflowDir() {
    // Determine workflow directory based on environment
    // In production, workflows are in resources/workflows (copied via extraResources)
    // In development, they are in their source location
    return app.isPackaged
        ? path.join(process.resourcesPath, "workflows")
        : path.resolve(process.cwd(), "src/engines/tianshu/workflows");
}

@Service({
    name: "tianshu",
    displayName: "天枢星君",
    priority: ServicePriority.Critical,
    description: "天枢星君化身，掌管工作流编排，协调诸天引擎，处理用户意图，确保天庭高效运转",
    dependencies: ["taiyi"], // 天枢依赖太乙进行引擎协调
    retryOnFailure: true,
    maxRetries: 3,
})
export default class TianshuService implements IService {
    readonly name = "tianshu";
    private tianshuEngine!: TianshuEngine;
    private taiyiService!: TaiyiService;

    // Promise跟踪器 - 基于commandId管理Promise
    private pendingCommands = new Map<
        string,
        {
            resolve: (result: any) => void;
            reject: (error: Error) => void;
            timeout: NodeJS.Timeout;
        }
    >();

    constructor(
        private ipcMain: IpcMain,
        private mainWindow: BrowserWindow,
        _: Electron.App,
        dependencies: Record<string, any>,
    ) {
        if (dependencies?.has("taiyi")) {
            this.taiyiService = dependencies.get("taiyi") as TaiyiService;
        } else {
            throw new Error("taiyi service not found");
        }
    }

    /**
     * 初始化天枢星君
     * 唤醒天枢星君，建立工作流编排体系
     */
    async initialize(): Promise<void> {
        try {
            const workflowDir = getWorkflowDir();
            logger.info(`Tianshu initializing with workflow dir: ${workflowDir}`);

            // 创建天枢引擎实例，传入太乙服务作为步骤执行器
            this.tianshuEngine = new TianshuEngine({
                workflowDir,
                maxConcurrentWorkflows: 5,
                defaultTimeout: 600000, // 10分钟超时（应对复杂文件夹扫描）
                enableHotReload: !app.isPackaged,
                stepExecutor: this.taiyiService as IStepExecutor,
            });

            await this.tianshuEngine.initialize();

            // 设置工作流事件监听器
            this.setupWorkflowEventListeners();

            // 注册IPC处理器
            this.setupIpcHandlers();
            logger.info("天枢服务已初始化");
        } catch (error) {
            // ✅ 修复：初始化失败时清理已注册的 handler，避免重试时重复注册
            this.cleanupIpcHandlers();
            throw error;
        }
    }

    /**
     * 关闭天枢星君
     * 让天枢星君进入休眠状态，保存当前状态
     */
    async shutdown(): Promise<void> {
        // 清理IPC处理器
        this.cleanupIpcHandlers();

        // 清理所有pending的Promise
        for (const [_commandId, pending] of this.pendingCommands) {
            clearTimeout(pending.timeout);
            pending.reject(new Error("Service shutting down"));
        }
        this.pendingCommands.clear();

        if (this.tianshuEngine) {
            await this.tianshuEngine.shutdown();
        }
    }

    /**
     * 清理IPC处理器（用于初始化失败或关闭时）
     * @private
     */
    private cleanupIpcHandlers(): void {
        this.ipcMain.removeHandler("tianshu.command");
        this.ipcMain.removeHandler("tianshu.status");
        logger.debug("🌌 天枢星君IPC处理器已清理");
    }

    /**
     * 设置工作流事件监听器
     * 基于commandId跟踪Promise并resolve/reject
     */
    private setupWorkflowEventListeners(): void {
        // 监听工作流完成事件
        this.tianshuEngine.on("workflowCompleted", (execution: any) => {
            const pending = this.pendingCommands.get(execution.commandId);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingCommands.delete(execution.commandId);

                // 提取工作流结果
                const result = this.extractWorkflowResult(execution);
                pending.resolve({
                    commandId: execution.commandId,
                    status: "completed",
                    result: result,
                    timestamp: Date.now(),
                });
            }
        });

        // 监听工作流失败事件
        this.tianshuEngine.on("workflowFailed", (execution: any) => {
            const pending = this.pendingCommands.get(execution.commandId);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingCommands.delete(execution.commandId);
                pending.reject(new Error(execution.error || "Workflow execution failed"));
            }
        });

        logger.info("🌌 工作流事件监听器已设置");
    }

    /**
     * 从执行上下文中提取工作流结果
     */
    private extractWorkflowResult(execution: any): any {
        if (!execution.stepResults) {
            return null;
        }

        // 查找有"return"动作的步骤（如format_response步骤）
        for (const [_stepName, stepResult] of execution.stepResults) {
            if (stepResult.output && stepResult.output.data !== undefined) {
                // 返回builtin return步骤的完整输出
                return stepResult.output;
            }
        }

        // 如果没有找到return步骤，返回最后一个成功步骤的结果
        const stepResults = Array.from(execution.stepResults.values());
        const lastSuccessStep = stepResults
            .reverse()
            .find((step: any) => step.status === "completed");
        return (lastSuccessStep as any)?.output || null;
    }

    /**
     * 设置天枢星君的通信渠道
     * 建立与渲染进程的通信桥梁，处理各种天庭事务
     */
    private setupIpcHandlers(): void {
        // ✅ 修复：防止重复注册 handler（服务可能被重复初始化）
        // 先移除已存在的 handler，避免 "Attempted to register a second handler" 错误
        // removeHandler 是幂等的，如果 handler 不存在也不会报错
        this.ipcMain.removeHandler("tianshu.command");
        this.ipcMain.removeHandler("tianshu.status");

        // 天枢星君命令处理 - 使用requestId模式跟踪Promise
        this.ipcMain.handle("tianshu.command", async (_, command) => {
            return new Promise((resolve, reject) => {
                // 设置超时（10分钟，应对复杂文件夹扫描操作）
                const timeout = setTimeout(() => {
                    this.pendingCommands.delete(command.id);
                    reject(new Error(`Command ${command.id} timed out after 10 minutes`));
                }, 600000);

                // 将Promise存储到跟踪器中
                this.pendingCommands.set(command.id, {
                    resolve,
                    reject,
                    timeout,
                });

                // Fire-and-forget: 提交命令到天枢引擎
                this.tianshuEngine.processCommand(command).catch((error) => {
                    // 如果processCommand立即失败，清理并reject
                    const pending = this.pendingCommands.get(command.id);
                    if (pending) {
                        clearTimeout(pending.timeout);
                        this.pendingCommands.delete(command.id);
                        reject(error);
                    }
                });
            });
        });

        // 天枢星君状态查询 - 汇报天庭运转状况
        this.ipcMain.handle("tianshu.status", async () => {
            return this.tianshuEngine.getSystemStatus();
        });

        // 监听天枢星君事件并广播给渲染进程
        this.tianshuEngine.on("progress", (progress) => {
            this.mainWindow.webContents.send("tianshu.progress", progress);
        });

        this.tianshuEngine.on("status", (status) => {
            this.mainWindow.webContents.send("tianshu.status", status);
        });

        logger.info("天枢星君IPC处理器已设置");
    }
}
