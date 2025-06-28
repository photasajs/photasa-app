import createWorker from "./config-worker?nodeWorker";
import type { IpcMain, BrowserWindow } from "electron";
import type { WorkerMessage, WorkerResponse } from "@common/worker-types";

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
export default class ConfigService {
    ipc: IpcMain;
    mainWindow: BrowserWindow;
    promises: Record<string, () => void> = {};
    queueId = 0;
    worker: ConfigWorker;

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;

        // 创建 worker
        this.worker = createWorker({ workerData: "worker" });

        // 处理 worker 消息
        this.worker.on("message", (message: string) => {
            // 解析消息
            const data = JSON.parse(message) as WorkerResponse;
            // 查询配置
            if (data.from === "query") {
                mainWindow?.webContents.send("picasa:photasa-config", data);
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
                mainWindow?.webContents.send("picasa:remove-config", data);
            }
        });

        // 查询配置
        ipcMain.on("picasa:query-config", async (_, args: { paths: string[] }) => {
            this.queryConfigs(args.paths);
        });

        // 添加配置
        ipcMain.handle("picasa:add-config", async (_, args: { paths: string[] }) => {
            return this.addConfig(args.paths);
        });
    }

    private queryConfigs(paths: string[]): void {
        const message: WorkerMessage = {
            action: "query",
            paths,
        };
        this.worker.postMessage(JSON.stringify(message));
    }

    private addConfig(paths: string[]): Promise<void> {
        return new Promise((resolve) => {
            this.promises[`${this.queueId}`] = resolve;
            const message: WorkerMessage = {
                queueId: this.queueId,
                action: "add",
                paths,
            };
            this.worker.postMessage(JSON.stringify(message));
            this.queueId++;
        });
    }
}
