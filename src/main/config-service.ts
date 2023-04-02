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
            mainWindow?.webContents.send("picasa:photasa-config", data);
        });

        ipcMain.on("picasa:query-config", async (_, args: { paths: string[] }) => {
            this.queryConfigs(args.paths);
        });
    }

    private queryConfigs(paths: string[]): void {
        this.worker.postMessage(JSON.stringify({ action: "load", paths }));
    }
}
