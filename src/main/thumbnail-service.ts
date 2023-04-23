import createWorker from "./thumbnail-worker?nodeWorker";
import type { IpcMain } from "electron";

type ThumbnailWorker = {
    on: (event: string, callback: (message: string) => void) => void;
    postMessage: (message: string) => void;
};

export default class ThumbnailService {
    ipc: IpcMain;
    promises = {};
    queueId = 0;
    worker: ThumbnailWorker;

    constructor(ipcMain: IpcMain) {
        this.ipc = ipcMain;
        this.worker = createWorker({ workerData: "worker" });
        this.worker.on("message", (message) => {
            const data = JSON.parse(message);
            const requestId = `${data.queueId}`;
            if (this.promises[requestId]) {
                this.promises[requestId](data.result);
                delete this.promises[requestId];
            }
        });

        this.ipc.handle("picasa:create-thumbnail", async (_, arg) => {
            return await this.createThumbnail(arg);
        });

        this.ipc.handle("picasa:remove-thumbnail", async (_, arg) => {
            return await this.removeThumbnail(arg);
        });
    }

    private createThumbnail(arg): Promise<string> {
        return this.queueRequest("create", arg);
    }

    private removeThumbnail(arg): Promise<string> {
        return this.queueRequest("remove", arg);
    }

    private queueRequest(action: string, arg): Promise<string> {
        return new Promise((resolve) => {
            this.promises[`${this.queueId}`] = resolve;
            this.worker?.postMessage(JSON.stringify({ queueId: this.queueId, action, arg }));
            this.queueId++;
        });
    }
}
