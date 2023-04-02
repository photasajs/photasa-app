import { ScanAction } from "../preload/types";
import createWorker from "./scan-worker?nodeWorker";
import type { IpcMain, BrowserWindow } from "electron";

type ScanWorker = {
    on: (event: string, callback: (message: string) => void) => void;
    postMessage: (message: string) => void;
};

export default class ScanService {
    ipc: IpcMain;
    mainWindow: BrowserWindow;
    promises = {};
    queueId = 0;
    worker: ScanWorker;

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;
        this.worker = createWorker({ workerData: "worker" });
        this.worker.on("message", (message) => {
            const data = JSON.parse(message);
            mainWindow?.webContents.send("picasa:find-photo", data);
        });

        ipcMain.on("picasa:scan-photos", async (_, args: { scanAction: ScanAction }) => {
            this.scanPhotos(args.scanAction);
        });
    }

    private scanPhotos(action: ScanAction): void {
        this.worker.postMessage(JSON.stringify({ action: "scan", scan: action }));
    }
}
