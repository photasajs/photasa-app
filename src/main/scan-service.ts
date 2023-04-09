import createWorker from "./scan-worker?nodeWorker";
import type { IpcMain, BrowserWindow } from "electron";
import log4js from "log4js";
import type { ScanAction } from "../preload/types";

const DEV_MODE = process.env.NODE_ENV === "development";
const logger = log4js.getLogger("scan-service");
logger.level = DEV_MODE ? "debug" : "info";

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
            if (data.action === "complete") {
                logger.info("Scan complete for " + data.path);
            }
            mainWindow?.webContents.send("picasa:find-photo", data);
        });

        ipcMain.on(
            "picasa:scan-photos",
            async (_, args: { requestId: string; scanAction: ScanAction }) => {
                this.scanPhotos(args.requestId, args.scanAction);
            },
        );
    }

    private scanPhotos(requestId: string, scan: ScanAction): void {
        this.worker.postMessage(JSON.stringify({ action: "scan", requestId, scan }));
    }
}
