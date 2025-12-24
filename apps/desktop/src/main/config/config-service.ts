import createWorker from "./config-worker?nodeWorker";
import type { IpcMain, BrowserWindow } from "electron";
import type { ConfigRequest, ConfigResponse } from "@common/config-types";
import { Service } from "../tianting/decorators/service-decorators";
import { ServicePriority, IService } from "../tianting/core/service-types";
import { loggers } from "@common/logger";

const logger = loggers.sibu;

/**
 * 配置 worker 类型
 */
type ConfigWorker = {
    on(event: "message", callback: (message: string) => void): void;
    on(event: "error", callback: (error: Error) => void): void;
    on(event: "exit", callback: (code: number) => void): void;
    postMessage: (message: string) => void;
};

/**
 * 配置服务，负责处理配置的查询、添加、移除等操作。
 */
@Service({
    name: "config",
    displayName: "配置服务",
    priority: ServicePriority.Critical,
    dependencies: [],
    lazyLoad: false,
    description: "管理应用程序配置和设置",
})
export default class ConfigService implements IService {
    readonly name = "config";
    ipc: IpcMain;
    mainWindow: BrowserWindow;
    promises: Record<string, () => void> = {};
    queueId = 0;
    worker!: ConfigWorker;
    private workerStatus: "initializing" | "ready" | "error" | "restarting" = "initializing";
    private heartbeatTimer?: NodeJS.Timeout;
    private workerRestartAttempts = 0;
    private readonly maxRestartAttempts = 3;

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;
    }

    /**
     * 初始化配置服务
     */
    async initialize(): Promise<void> {
        await this.initializeWorker();
        this.startHealthCheck();

        // 查询配置
        this.ipc.on("picasa:query-config", async (_, args: { paths: string[] }) => {
            this.queryConfigs(args.paths);
        });

        // 添加配置
        this.ipc.handle("picasa:add-config", async (_, args: { paths: string[] }) => {
            return this.addConfig(args.paths);
        });
    }

    /**
     * 初始化或重新初始化worker
     */
    private async initializeWorker(): Promise<void> {
        this.workerStatus = "initializing";

        try {
            // 创建 worker
            this.worker = createWorker({ workerData: "worker" });

            // 增强的 worker 消息处理
            this.worker.on("message", (message: string) => {
                try {
                    const data = JSON.parse(message) as ConfigResponse;
                    this.handleWorkerMessage(data);

                    // 更新worker状态为就绪
                    if (this.workerStatus === "initializing") {
                        this.workerStatus = "ready";
                        this.workerRestartAttempts = 0; // 重置重启计数
                        this.reportStatus(); // 报告状态变化
                    }
                } catch (error) {
                    logger.error("处理worker消息失败:", error);
                }
            });

            // Worker错误处理
            this.worker.on("error", (error) => {
                logger.error("Worker错误:", error);
                this.workerStatus = "error";
                this.reportStatus(); // 报告错误状态
                this.attemptWorkerRestart();
            });

            // Worker退出处理
            this.worker.on("exit", (code: number) => {
                logger.error(`Worker退出: ${code}`);
                this.workerStatus = "error";
                this.reportStatus(); // 报告退出状态
                if (code !== 0) {
                    this.attemptWorkerRestart();
                }
            });
        } catch (error) {
            logger.error("初始化worker失败:", error);
            this.workerStatus = "error";
            throw error;
        }
    }

    /**
     * 尝试重启worker
     */
    private async attemptWorkerRestart(): Promise<void> {
        if (this.workerRestartAttempts >= this.maxRestartAttempts) {
            logger.error("达到最大worker重启次数");
            return;
        }

        this.workerRestartAttempts++;
        this.workerStatus = "restarting";
        this.reportStatus(); // 报告重启状态

        logger.info(
            `[ConfigService] Attempting worker restart ${this.workerRestartAttempts}/${this.maxRestartAttempts}`,
        );

        // 等待一段时间后重启
        setTimeout(async () => {
            try {
                await this.initializeWorker();
            } catch (error) {
                logger.error("Worker重启失败:", error);
            }
        }, 1000 * this.workerRestartAttempts); // 递增延迟
    }

    /**
     * 启动健康检查
     */
    private startHealthCheck(): void {
        // 每30秒检查一次worker状态
        this.heartbeatTimer = setInterval(() => {
            if (this.workerStatus === "ready") {
                // 发送心跳包检查worker是否响应
                this.sendHeartbeat();
            }
        }, 30000);
    }

    /**
     * 发送心跳包
     */
    private sendHeartbeat(): void {
        try {
            const heartbeat = JSON.stringify({
                action: "heartbeat",
                timestamp: Date.now(),
            });
            this.worker.postMessage(heartbeat);
        } catch (error) {
            logger.error("发送心跳包失败:", error);
            this.workerStatus = "error";
            this.reportStatus(); // 报告心跳失败状态
            this.attemptWorkerRestart();
        }
    }

    /**
     * 关闭配置服务
     */
    async shutdown(): Promise<void> {
        // 清理健康检查定时器
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }

        // 清理 IPC 处理器
        this.ipc.removeAllListeners("picasa:query-config");
        this.ipc.removeHandler("picasa:add-config");

        // 清理 worker（如果有清理方法的话）
        // this.worker.terminate?.();
        this.workerStatus = "error";
    }

    private queryConfigs(paths: string[]): void {
        const message: ConfigRequest = {
            action: "query",
            paths,
        };
        this.sendToWorker(message);
    }

    private addConfig(paths: string[]): Promise<void> {
        return new Promise((resolve) => {
            this.promises[`${this.queueId}`] = resolve;
            const message: ConfigRequest = {
                queueId: this.queueId,
                action: "add",
                paths,
            };
            this.worker.postMessage(JSON.stringify(message));
            this.queueId++;
        });
    }

    /**
     * 处理Worker消息的统一入口
     */
    private handleWorkerMessage(data: ConfigResponse): void {
        // 心跳包响应
        if (data.action === "heartbeat") {
            // Worker正常响应心跳，无需特殊处理
            return;
        }

        // 查询配置响应
        if (data.from === "query") {
            this.mainWindow?.webContents.send("picasa:photasa-config", data);
            return;
        }

        // 添加配置响应
        if (data.from === "add" && (data.action === "complete" || data.action === "error")) {
            const requestId = `${data.queueId}`;
            if (this.promises[requestId]) {
                this.promises[requestId]();
                delete this.promises[requestId];
            }
            return;
        }

        // 移除配置响应
        if (data.from === "remove") {
            this.mainWindow?.webContents.send("picasa:remove-config", data);
            return;
        }

        // 引擎状态消息 (为将来的Tianshu集成预留)
        if (data.action === "engine-status") {
            this.handleEngineStatus(data);
            return;
        }

        // 未知消息类型
        logger.warn("未知worker消息类型:", data);
    }

    /**
     * 处理引擎状态消息 (为Tianshu集成预留)
     */
    private handleEngineStatus(data: ConfigResponse): void {
        // 将来可以转发给Tianshu进行统一状态管理
        logger.debug("引擎状态:", data);

        // 向前端报告引擎状态
        this.mainWindow?.webContents.send("picasa:engine-status", {
            engine: "sibu",
            status: data.status,
            timestamp: data.timestamp || Date.now(),
            data: data,
        });
    }

    /**
     * 获取当前worker状态
     */
    getWorkerStatus(): string {
        return this.workerStatus;
    }

    /**
     * 报告服务状态给Tianshu (预留接口)
     */
    reportStatus(): void {
        const statusReport = {
            service: "config",
            workerStatus: this.workerStatus,
            restartAttempts: this.workerRestartAttempts,
            timestamp: Date.now(),
            isHealthy: this.workerStatus === "ready",
        };

        // 将来可以发送给Tianshu引擎进行统一状态管理
        logger.debug("状态报告:", statusReport);

        // 向前端报告服务状态
        this.mainWindow?.webContents.send("picasa:service-status", statusReport);
    }

    /**
     * 增强的Worker消息发送
     */
    private sendToWorker(message: ConfigRequest): void {
        try {
            this.worker.postMessage(JSON.stringify(message));
        } catch (error) {
            logger.error("发送消息到worker失败:", error);
            // 可以在这里添加重试逻辑或错误恢复
        }
    }
}
