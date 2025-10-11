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
import { Service } from "../services/decorators/service-decorators";
import { ServicePriority, IService } from "../services/core/service-types";

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
@Service({
    name: "thumbnail",
    displayName: "缩略图服务",
    priority: ServicePriority.Critical,
    startupDelay: 0,
    dependencies: ["logViewer"],
    lazyLoad: false,
    description: "生成和管理图片缩略图",
})
export default class ThumbnailService implements IService {
    readonly name = "thumbnail";
    ipc: IpcMain;
    mainWindow: BrowserWindow;
    app: Electron.App;
    worker!: ThumbnailWorker;

    constructor(
        ipcMain: IpcMain,
        mainWindow: BrowserWindow,
        app: Electron.App,
        dependencies?: Map<string, any>,
    ) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;
        this.app = app;

        // 从依赖映射中获取 logViewerService
        if (dependencies) {
            logViewerService = dependencies.get("logViewer");
        }
    }

    /**
     * 初始化缩略图服务
     */
    async initialize(): Promise<void> {
        logger.debug("[ThumbnailService] Creating thumbnail worker");

        // 创建 worker，传递应用路径
        this.worker = createWorker({
            workerData: "worker",
            env: {
                ...process.env,
                APP_PATH: getAppPath(this.app),
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
                    // 处理 worker 日志消息，通过 IPC 发送给 LogViewerService
                    if (logViewerService) {
                        // 使用 IPC 发送，让 LogViewerService 统一处理
                        this.ipc.emit("worker:log", null, data.entry);
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
                logger.error(
                    `[ThumbnailService] Error processing worker message: ${(error as Error)?.message || String(error)}`,
                    {
                        error: (error as Error)?.stack,
                    },
                );
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

        logger.info("[ThumbnailService] 缩略图服务已初始化");
    }

    /**
     * 关闭缩略图服务
     */
    async shutdown(): Promise<void> {
        // 清理 IPC 处理器
        this.ipc.removeHandler(ThumbnailServiceAction.create);
        this.ipc.removeHandler(ThumbnailServiceAction.remove);

        // 关闭 worker
        if (this.worker) {
            this.worker.terminate();
        }

        logger.info("[ThumbnailService] 缩略图服务已关闭");
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
