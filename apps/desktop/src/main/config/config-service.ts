import createWorker from "./config-worker?nodeWorker";
import type { IpcMain, BrowserWindow } from "electron";
import type { ConfigRequest, ConfigResponse } from "@photasa/common";
import {
    routeConfigResponse,
    WorkerSupervisor,
    type ConfigRoutedAction,
} from "@photasa/config-core";
import { Service } from "../tianting/decorators/service-decorators";
import { ServicePriority, IService } from "../tianting/core/service-types";
import { loggers } from "@photasa/common";

const logger = loggers.sibu;

const CONFIG_MAX_WORKER_RESTART_ATTEMPTS = 3;

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
    private readonly supervisor: WorkerSupervisor;

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;
        this.supervisor = new WorkerSupervisor({
            maxRestartAttempts: CONFIG_MAX_WORKER_RESTART_ATTEMPTS,
            sendHeartbeat: () => {
                const heartbeat = JSON.stringify({
                    action: "heartbeat",
                    timestamp: Date.now(),
                });
                this.worker.postMessage(heartbeat);
            },
            recreateWorker: () => {
                void this.initializeWorker();
            },
            onStatusChange: () => this.reportStatus(),
            onMaxRestartAttemptsReached: () => {
                logger.error("达到最大worker重启次数");
            },
        });
    }

    /**
     * 初始化配置服务
     */
    async initialize(): Promise<void> {
        await this.initializeWorker();
        this.supervisor.startHealthCheck();

        this.ipc.on("picasa:query-config", async (_, args: { paths: string[] }) => {
            this.queryConfigs(args.paths);
        });

        this.ipc.handle("picasa:add-config", async (_, args: { paths: string[] }) => {
            return this.addConfig(args.paths);
        });
    }

    /**
     * 初始化或重新初始化worker
     */
    private async initializeWorker(): Promise<void> {
        this.supervisor.markInitializing();

        try {
            this.worker = createWorker({ workerData: "worker" });

            this.worker.on("message", (message: string) => {
                try {
                    const data = JSON.parse(message) as ConfigResponse;
                    this.dispatchRoutedConfigMessage(routeConfigResponse(data));
                    this.supervisor.markReadyFromMessage();
                } catch (error) {
                    logger.error("处理worker消息失败:", error);
                }
            });

            this.worker.on("error", (error) => {
                logger.error("Worker错误:", error);
                this.supervisor.notifyWorkerError();
            });

            this.worker.on("exit", (code: number) => {
                logger.error(`Worker退出: ${code}`);
                this.supervisor.notifyWorkerExit(code);
            });
        } catch (error) {
            logger.error("初始化worker失败:", error);
            this.supervisor.notifyInitializerFailed();
            throw error;
        }
    }

    /**
     * 关闭配置服务
     */
    async shutdown(): Promise<void> {
        this.supervisor.dispose();

        this.ipc.removeAllListeners("picasa:query-config");
        this.ipc.removeHandler("picasa:add-config");
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

    private dispatchRoutedConfigMessage(routed: ConfigRoutedAction): void {
        switch (routed.kind) {
            case "heartbeat":
                return;
            case "query-result":
                this.mainWindow?.webContents.send("picasa:photasa-config", routed.payload);
                return;
            case "add-finished": {
                const requestId = `${routed.queueId}`;
                if (this.promises[requestId]) {
                    this.promises[requestId]();
                    delete this.promises[requestId];
                }
                return;
            }
            case "remove-result":
                this.mainWindow?.webContents.send("picasa:remove-config", routed.payload);
                return;
            case "engine-status":
                this.handleEngineStatus(routed.payload);
                return;
            case "unknown":
                logger.warn("未知worker消息类型:", routed.payload);
                return;
            default: {
                const _exhaustive: never = routed;
                return _exhaustive;
            }
        }
    }

    /**
     * 处理引擎状态消息 (为Tianshu集成预留)
     */
    private handleEngineStatus(data: ConfigResponse): void {
        logger.debug("引擎状态:", data);
        this.mainWindow?.webContents.send("picasa:engine-status", {
            engine: "sibu",
            status: data.status,
            timestamp: data.timestamp || Date.now(),
            data,
        });
    }

    /**
     * 获取当前worker状态
     */
    getWorkerStatus(): string {
        return this.supervisor.getStatus();
    }

    /**
     * 报告服务状态给Tianshu (预留接口)
     */
    reportStatus(): void {
        const statusReport = {
            service: "config",
            workerStatus: this.supervisor.getStatus(),
            restartAttempts: this.supervisor.getRestartAttempts(),
            timestamp: Date.now(),
            isHealthy: this.supervisor.getStatus() === "ready",
        };
        logger.debug("状态报告:", statusReport);
        this.mainWindow?.webContents.send("picasa:service-status", statusReport);
    }

    private sendToWorker(message: ConfigRequest): void {
        try {
            this.worker.postMessage(JSON.stringify(message));
        } catch (error) {
            logger.error("发送消息到worker失败:", error);
        }
    }
}
