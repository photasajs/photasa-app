import createWorker from "./thumbnail-worker?nodeWorker";
import type { IpcMain } from "electron";
import type { WorkerResponse } from "@common/types";
import {
    ThumbnailServiceAction,
    ThumbnailRequest,
    ThumbnailResponse,
} from "@common/thumbnail-types";
import { sendWorkerTask, onWorkerResponse, Worker } from "@common/worker-util";

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

    constructor(ipcMain: IpcMain) {
        this.ipc = ipcMain;
        // 创建 worker
        this.worker = createWorker({ workerData: "worker" });
        // 处理 worker 消息
        this.worker.on("message", (message: WorkerResponse<ThumbnailResponse>) => {
            onWorkerResponse<ThumbnailResponse>(message);
        });
        // 创建缩略图
        this.ipc.handle(ThumbnailServiceAction.create, async (_, arg: ThumbnailRequest) => {
            return await this.createThumbnail(arg);
        });
        // 删除缩略图
        this.ipc.handle(ThumbnailServiceAction.remove, async (_, arg: ThumbnailRequest) => {
            return await this.removeThumbnail(arg);
        });
    }

    private createThumbnail(arg: ThumbnailRequest): Promise<ThumbnailResponse> {
        return sendWorkerTask<ThumbnailWorker, ThumbnailRequest, ThumbnailResponse>(
            this.worker,
            "create",
            arg,
        );
    }

    private removeThumbnail(arg: ThumbnailRequest): Promise<ThumbnailResponse> {
        return sendWorkerTask<ThumbnailWorker, ThumbnailRequest, ThumbnailResponse>(
            this.worker,
            "remove",
            arg,
        );
    }
}
