import createWorker from "./config-worker?nodeWorker";
import type { IpcMain, BrowserWindow } from "electron";

type ThumbnailWorker = {
    on: (event: string, callback: (message: string) => void) => void;
    postMessage: (message: string) => void;
};

export default class ConfigService {
    ipc: IpcMain;
    mainWindow: BrowserWindow;
    promises = {};
    queueId = 0;
    worker: ThumbnailWorker;

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;
        this.worker = createWorker({ workerData: "worker" });
        this.worker.on("message", (message) => {
            const data = JSON.parse(message);
            if (data.from === "query") {
                mainWindow?.webContents.send("picasa:photasa-config", data);
            }
            if (data.from === "add" && (data.action === "complete" || data.action === "error")) {
                const requestId = `${data.queueId}`;
                if (this.promises[requestId]) {
                    this.promises[requestId]();
                    delete this.promises[requestId];
                }
            }
            if (data.from === "remove") {
                mainWindow?.webContents.send("picasa:remove-config", data);
            }
        });

        ipcMain.on("picasa:query-config", async (_, args: { paths: string[] }) => {
            this.queryConfigs(args.paths);
        });

        ipcMain.handle("picasa:add-config", async (_, args: { paths: string[] }) => {
            return this.addConfig(args.paths);
        });
    }

    private queryConfigs(paths: string[]): void {
        this.worker.postMessage(JSON.stringify({ action: "query", paths }));
    }

    private addConfig(paths: string[]): Promise<void> {
        return new Promise((resolve) => {
            this.promises[`${this.queueId}`] = resolve;
            this.worker.postMessage(
                JSON.stringify({ queueId: this.queueId, action: "add", paths }),
            );
            this.queueId++;
        });
    }
}
