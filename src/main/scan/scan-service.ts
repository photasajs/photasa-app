import createWorker from "./scan-worker?nodeWorker";
import type { IpcMain, BrowserWindow } from "electron";
import type { ScanAction } from "@common/types";
import { loggers } from "@common/logger";

const logger = loggers.scan;

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
        logger.debug("Creating scan worker");
        this.worker = createWorker({ workerData: "worker" });
        this.worker.on("message", (message) => {
            try {
                const data = JSON.parse(message);
                logger.debug("Received message from worker:", data);
                if (data.type === "error") {
                    logger.error("Worker reported error:", data.error);
                } else if (data.type === "complete") {
                    logger.info("Scan complete for " + data.action.path);
                }
                mainWindow?.webContents.send("picasa:find-photo", data);
            } catch (error) {
                logger.error("Error processing worker message:", error);
            }
        });

        ipcMain.on(
            "picasa:scan-photos",
            async (_, args: { requestId: string; scanAction: ScanAction }) => {
                logger.debug("Received scan request:", args);
                try {
                    this.scanPhotos(args.requestId, args.scanAction);
                } catch (error) {
                    logger.error("Error handling scan request:", error);
                    mainWindow?.webContents.send("picasa:find-photo", {
                        type: "error",
                        requestId: args.requestId,
                        error,
                    });
                }
            },
        );
    }

    private scanPhotos(requestId: string, scan: ScanAction): void {
        logger.debug("Sending scan request to worker:", { requestId, scan });
        try {
            this.worker.postMessage(JSON.stringify({ action: "scan", requestId, scan }));
        } catch (error) {
            logger.error("Error sending scan request to worker:", error);
            this.mainWindow?.webContents.send("picasa:find-photo", {
                type: "error",
                requestId,
                error,
            });
        }
    }
}
