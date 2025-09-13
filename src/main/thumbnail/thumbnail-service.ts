import createWorker from "./thumbnail-worker?nodeWorker";
import type { IpcMain, BrowserWindow } from "electron";
import { getAppPath } from "@shared/path-util";
import {
    ThumbnailServiceAction,
    ThumbnailRequest,
    ThumbnailResponse,
} from "@common/thumbnail-types";
import { sendWorkerTask, onWorkerResponse, Worker } from "@common/worker-util";
import { loggers } from "@common/logger";

/**
 * 缩略图 worker 类型
 */
type ThumbnailWorker = Worker<ThumbnailRequest, ThumbnailResponse>;
const logger = loggers.thumbnail;

// Import LogViewerService to register worker
let logViewerService: any = null;

/**
 * 缩略图服务
 */
export default class ThumbnailService {
    ipc: IpcMain;
    mainWindow: BrowserWindow;
    worker: ThumbnailWorker;

    constructor(
        ipcMain: IpcMain,
        mainWindow: BrowserWindow,
        app: Electron.App,
        logViewerSvc?: any,
    ) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;
        logViewerService = logViewerSvc;

        logger.debug("[ThumbnailService] Creating thumbnail worker");
        // 创建 worker，传递应用路径

        this.worker = createWorker({
            workerData: "worker",
            env: {
                ...process.env,
                APP_PATH: getAppPath(app),
            },
        });

        // 注册worker到LogViewerService
        if (logViewerService) {
            logViewerService.registerWorker(this.worker);
        }

        // 处理 worker 消息
        this.worker.on("message", (message) => {
            try {
                const data = message as any; // 临时使用any类型，因为消息可能包含额外字段

                // 为不同类型的消息提供更清晰的日志
                if (data.type === "worker:log") {
                    // 处理 worker 日志消息，转发给 LogViewerService
                    if (logViewerService) {
                        this.mainWindow?.webContents.send("log:entry", data.entry);
                    }
                    // 为 worker:log 提供简洁的调试日志
                    logger.debug(
                        `[ThumbnailService] Worker log [${data.entry?.level?.toUpperCase()}]: ${data.entry?.message || "N/A"}`,
                    );
                    return; // worker:log 消息不需要进一步处理
                }

                // 处理标准的 thumbnail 响应消息
                onWorkerResponse<ThumbnailResponse>(data);
            } catch (error) {
                logger.error("[ThumbnailService] Error processing worker message:", error);
            }
        });
        // 创建缩略图
        this.ipc.handle(ThumbnailServiceAction.create, async (_, arg: ThumbnailRequest) => {
            logger.info("[ThumbnailService] Create thumbnail for : " + arg.thumbnail);
            return await this.createThumbnail(arg);
        });
        // 删除缩略图
        this.ipc.handle(ThumbnailServiceAction.remove, async (_, arg: ThumbnailRequest) => {
            logger.info("[ThumbnailService] Remove thumbnail for : " + arg.thumbnail);
            return await this.removeThumbnail(arg);
        });
    }

    private createThumbnail(arg: ThumbnailRequest): Promise<ThumbnailResponse> {
        logger.info(
            "[ThumbnailService] send worker task to create thumbnail for : " + arg.thumbnail,
        );
        return sendWorkerTask<ThumbnailWorker, ThumbnailRequest, ThumbnailResponse>(
            this.worker,
            "create",
            arg,
        );
    }

    private removeThumbnail(arg: ThumbnailRequest): Promise<ThumbnailResponse> {
        logger.info(
            "[ThumbnailService] send worker task to remove thumbnail for : " + arg.thumbnail,
        );
        return sendWorkerTask<ThumbnailWorker, ThumbnailRequest, ThumbnailResponse>(
            this.worker,
            "remove",
            arg,
        );
    }
}
