import createWorker from "./scan-worker?nodeWorker";
import type { IpcMain, BrowserWindow } from "electron";
import type { ScanAction } from "@common/scan-types";
import { loggers } from "@common/logger";
import { notifyStatus } from "./notify";
import type { NotifyPayload } from "@common/types";
import { getAppPath } from "@shared/path-util";

const logger = loggers.scan;

type ScanWorker = {
    on: (event: string, callback: (message: any) => void) => void;
    postMessage: (message: any) => void;
};

export default class ScanService {
    ipc: IpcMain;
    mainWindow: BrowserWindow;
    promises = {};
    queueId = 0;
    worker: ScanWorker;

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow, app: Electron.App) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;
        logger.debug("Creating scan worker");
        this.worker = createWorker({
            workerData: "worker",
            env: {
                ...process.env,
                APP_PATH: getAppPath(app),
            },
        });

        // 处理 worker 消息
        this.worker.on("message", (message) => {
            try {
                const data = message;
                logger.debug(
                    `Received message from worker: type=${data.type}, requestId=${data.requestId}, path=${data.action?.path || "N/A"}, progress=${data.progress ? `${data.progress.processed}/${data.progress.total}` : "N/A"}`,
                );
                // 推送 notifyStatus
                let payload: NotifyPayload | undefined;
                if (data.type === "error") {
                    logger.error("Worker reported error:", data.error);
                    payload = {
                        type: "scan",
                        task: data.action?.path || "",
                        status: "error",
                        error: data.error?.message || String(data.error),
                        timestamp: Date.now(),
                    };
                } else if (data.type === "complete") {
                    logger.info("Scan complete for " + data.action.path);
                    payload = {
                        type: "scan",
                        task: data.action?.path || "",
                        status: "complete",
                        timestamp: Date.now(),
                    };
                } else if (data.type === "progress") {
                    payload = {
                        type: "scan",
                        task: data.action?.path || "",
                        status: "progress",
                        data: data.progress,
                        timestamp: Date.now(),
                    };
                }
                if (payload) {
                    notifyStatus(this.mainWindow, payload);
                }
                // 若有批量paths，优先推送paths，否则推送单个data
                if (data.type === "complete" && Array.isArray(data.paths)) {
                    this.mainWindow?.webContents.send("picasa:find-photo", {
                        ...data,
                        paths: data.paths,
                    });
                } else {
                    this.mainWindow?.webContents.send("picasa:find-photo", data);
                }
            } catch (error) {
                logger.error("Error processing worker message:", error);
            }
        });

        // 处理扫描请求
        ipcMain.on(
            "picasa:scan-photos",
            async (_, args: { requestId: string; scanAction: ScanAction }) => {
                logger.debug(
                    `Received scan request: requestId=${args.requestId}, action=${args.scanAction.action}, path=${args.scanAction.path}`,
                );
                try {
                    this.scanPhotos(args.requestId, args.scanAction);
                } catch (error) {
                    logger.error("Error handling scan request:", error);
                    this.mainWindow?.webContents.send("picasa:find-photo", {
                        type: "error",
                        requestId: args.requestId,
                        error,
                    });
                }
            },
        );
    }

    private scanPhotos(requestId: string, scan: ScanAction): void {
        logger.debug(
            `Sending scan request: requestId=${requestId}, path=${scan.path}, action=${scan.action}`,
        );
        try {
            this.worker.postMessage({ action: "scan", requestId, scan });
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
