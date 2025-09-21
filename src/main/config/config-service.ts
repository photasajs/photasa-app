import createWorker from "./config-worker?nodeWorker";
import type { IpcMain, BrowserWindow } from "electron";
import type { ConfigRequest, ConfigResponse } from "@common/config-types";
import { Service } from "../services/decorators/service-decorators";
import { ServicePriority, IService } from "../services/core/service-types";

/**
 * 配置 worker 类型
 */
type ConfigWorker = {
    on: (event: string, callback: (message: string) => void) => void;
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

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;
    }

    /**
     * 初始化配置服务
     */
    async initialize(): Promise<void> {
        // 创建 worker
        this.worker = createWorker({ workerData: "worker" });

        // 处理 worker 消息
        this.worker.on("message", (message: string) => {
            // 解析消息
            const data = JSON.parse(message) as ConfigResponse;
            // 查询配置
            if (data.from === "query") {
                this.mainWindow?.webContents.send("picasa:photasa-config", data);
                return;
            }
            // 添加配置
            if (data.from === "add" && (data.action === "complete" || data.action === "error")) {
                const requestId = `${data.queueId}`;
                if (this.promises[requestId]) {
                    this.promises[requestId]();
                    delete this.promises[requestId];
                }
            }
            // 移除配置
            if (data.from === "remove") {
                this.mainWindow?.webContents.send("picasa:remove-config", data);
            }
        });

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
     * 关闭配置服务
     */
    async shutdown(): Promise<void> {
        // 清理 IPC 处理器
        this.ipc.removeAllListeners("picasa:query-config");
        this.ipc.removeHandler("picasa:add-config");

        // 清理 worker（如果有清理方法的话）
        // this.worker.terminate?.();
    }

    private queryConfigs(paths: string[]): void {
        const message: ConfigRequest = {
            action: "query",
            paths,
        };
        this.worker.postMessage(JSON.stringify(message));
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
}
