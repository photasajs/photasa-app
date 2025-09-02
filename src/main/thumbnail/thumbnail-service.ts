import createWorker from "./thumbnail-worker?nodeWorker";
import type { IpcMain } from "electron";
import { app } from "electron";
import type { WorkerResponse } from "@common/types";
import {
    ThumbnailServiceAction,
    ThumbnailRequest,
    ThumbnailResponse,
} from "@common/thumbnail-types";
import { sendWorkerTask, onWorkerResponse, Worker } from "@common/worker-util";
import { getLogger } from "@common/logger";

/**
 * 缩略图 worker 类型
 */
type ThumbnailWorker = Worker<ThumbnailRequest, ThumbnailResponse>;

/**
 * 缩略图服务
 */
export default class ThumbnailService {
    ipc: IpcMain;
    worker: ThumbnailWorker;
    logger = getLogger("thumbnail");

    constructor(ipcMain: IpcMain) {
        this.ipc = ipcMain;
        // 创建 worker，传递应用路径

        this.worker = createWorker({
            workerData: "worker",
            env: {
                ...process.env,
                APP_PATH: app.getAppPath(),
            },
        });
        // 处理 worker 消息
        this.worker.on("message", (message: WorkerResponse<ThumbnailResponse>) => {
            onWorkerResponse<ThumbnailResponse>(message);
        });
        // 创建缩略图
        this.ipc.handle(ThumbnailServiceAction.create, async (_, arg: ThumbnailRequest) => {
            this.logger.info("[thumbnail-service] Create thumbnail for : " + arg.thumbnail);
            return await this.createThumbnail(arg);
        });
        // 删除缩略图
        this.ipc.handle(ThumbnailServiceAction.remove, async (_, arg: ThumbnailRequest) => {
            this.logger.info("[thumbnail-service] Remove thumbnail for : " + arg.thumbnail);
            return await this.removeThumbnail(arg);
        });
    }

    private createThumbnail(arg: ThumbnailRequest): Promise<ThumbnailResponse> {
        this.logger.info(
            "[thumbnail-service] send worker task to create thumbnail for : " + arg.thumbnail,
        );
        return sendWorkerTask<ThumbnailWorker, ThumbnailRequest, ThumbnailResponse>(
            this.worker,
            "create",
            arg,
        );
    }

    private removeThumbnail(arg: ThumbnailRequest): Promise<ThumbnailResponse> {
        this.logger.info(
            "[thumbnail-service] send worker task to remove thumbnail for : " + arg.thumbnail,
        );
        return sendWorkerTask<ThumbnailWorker, ThumbnailRequest, ThumbnailResponse>(
            this.worker,
            "remove",
            arg,
        );
    }
}
