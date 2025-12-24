import createWorker from "./scan-worker?nodeWorker";
import type { IpcMain, BrowserWindow } from "electron";
import type { ScanAction } from "@common/scan-types";
import { loggers } from "@common/logger";
import { notifyStatus } from "./status/notify";
import type { NotifyPayload } from "@common/types";
import { getAppPath } from "@shared/path-util";
import { Service } from "@main/tianting/decorators/service-decorators";
import { ServicePriority, IService } from "@main/tianting/core/service-types";
import isDev from "electron-is-dev";

const logger = loggers.scan;

// Import LogViewerService to register worker
let logViewerService: any = null;

type ScanWorker = {
    on: (event: string, callback: (message: any) => void) => void;
    postMessage: (message: any) => void;
};

/**
 * ScanService is a CRITICAL core service that must start immediately with the app.
 *
 * Why this service is Critical:
 * 1. Photo scanning is the core functionality - users expect immediate photo indexing
 * 2. Must be active from app start to process file change events from WatchService
 * 3. UI components depend on scan results for photo display and management
 * 4. Any delay or background priority would cause poor user experience and missed events
 * 5. The scan queue processes file operations from the watch service in real-time
 *
 * Environment-based configuration:
 * - Production: Critical priority, no delay - must start immediately for core functionality
 * - Development: Slight delay to improve startup performance during development
 *
 * Configuration rationale:
 * - Priority.Critical: Ensures immediate initialization with other core services
 * - startupDelay: Environment-based - 0 for production, small delay for dev
 * - lazyLoad: false: Always auto-initialize, never wait for explicit request
 *
 * IMPORTANT: Do NOT change these settings without understanding the impact on core functionality
 */
@Service({
    name: "scan",
    displayName: "扫描服务",
    priority: ServicePriority.Critical,
    startupDelay: isDev ? 1500 : 0, // 开发环境延迟1.5秒，生产环境立即启动
    dependencies: ["logViewer", "config"],
    lazyLoad: false,
    description: "扫描和索引照片文件",
})
export default class ScanService implements IService {
    readonly name = "scan";
    ipc: IpcMain;
    mainWindow: BrowserWindow;
    app: Electron.App;
    promises = {};
    queueId = 0;
    worker!: ScanWorker;

    // Main process constructor
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
        if (dependencies?.has("logViewer")) {
            logViewerService = dependencies.get("logViewer");
        }
    }

    /**
     * 初始化扫描服务
     */
    async initialize(): Promise<void> {
        logger.debug("[ScanService] Creating scan worker");
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
                const data = message;

                // 为不同类型的消息提供更清晰的日志
                if (data.type === "worker:log") {
                    // 处理 worker 日志消息，通过 IPC 发送给 LogViewerService
                    if (logViewerService) {
                        // 使用 IPC 发送，让 LogViewerService 统一处理
                        this.ipc.emit("worker:log", null, data.entry);
                    }
                    // 为 worker:log 提供简洁的调试日志
                    logger.debug(
                        `[ScanService] Worker log [${data.entry?.level?.toUpperCase()}]: ${data.entry?.message || "N/A"}`,
                    );
                    return; // worker:log 消息不需要进一步处理
                }

                // 为其他类型消息提供详细的调试日志
                logger.debug(
                    `[ScanService] Received ${data.type} from worker: requestId=${data.requestId || "N/A"}, path=${data.action?.path || "N/A"}, progress=${data.progress ? `${data.progress.processed}/${data.progress.total}` : "N/A"}`,
                );

                // 推送 notifyStatus
                let payload: NotifyPayload | undefined;
                if (data.type === "error") {
                    logger.error(
                        `[ScanService] Worker reported error: ${data.error?.message || String(data.error)}`,
                        {
                            error: data.error,
                            path: data.action?.path,
                        },
                    );
                    payload = {
                        type: "scan",
                        task: data.action?.path || "",
                        status: "error",
                        error: data.error?.message || String(data.error),
                        timestamp: Date.now(),
                    };
                } else if (data.type === "complete") {
                    logger.info("[ScanService] Scan complete for " + data.action.path);
                    payload = {
                        type: "scan",
                        task: data.action?.path || "",
                        status: "complete",
                        timestamp: Date.now(),
                    };
                } else if (data.type === "progress") {
                    // 如果有当前处理的文件，传递文件名让前端处理国际化；否则显示路径
                    const taskDisplay = data.currentFile || data.action?.path || "";

                    payload = {
                        type: "scan",
                        task: taskDisplay,
                        status: "progress",
                        data: {
                            ...data.progress,
                            currentFile: data.currentFile, // 传递文件名给前端
                        },
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
                logger.error(
                    `[ScanService] Error processing worker message: ${(error as Error)?.message || String(error)}`,
                    {
                        error: (error as Error)?.stack,
                    },
                );
            }
        });

        // 处理扫描请求
        this.ipc.on(
            "picasa:scan-photos",
            async (_, args: { requestId: string; scanAction: ScanAction }) => {
                logger.debug(
                    `[ScanService] Received scan request: requestId=${args.requestId}, action=${args.scanAction.action}, path=${args.scanAction.path}`,
                );
                try {
                    this.scanPhotos(args.requestId, args.scanAction);
                } catch (error) {
                    logger.error(
                        `[ScanService] Error handling scan request: ${(error as Error)?.message || String(error)}`,
                        {
                            error: (error as Error)?.stack,
                            requestId: args.requestId,
                            action: args.scanAction,
                        },
                    );
                    this.mainWindow?.webContents.send("picasa:find-photo", {
                        type: "error",
                        requestId: args.requestId,
                        error,
                    });
                }
            },
        );

        logger.info("[ScanService] 扫描服务已初始化");
    }

    /**
     * 关闭扫描服务
     */
    async shutdown(): Promise<void> {
        // 清理 IPC 监听器
        this.ipc.removeAllListeners("picasa:scan-photos");

        // 关闭 worker
        if (this.worker) {
            (this.worker as any).terminate();
        }

        logger.info("[ScanService] 扫描服务已关闭");
    }

    private scanPhotos(requestId: string, scan: ScanAction): void {
        logger.debug(
            `[ScanService] Sending scan request: requestId=${requestId}, path=${scan.path}, action=${scan.action}`,
        );
        try {
            this.worker.postMessage({ action: "scan", requestId, scan });
        } catch (error) {
            logger.error(
                `[ScanService] Error sending scan request to worker: ${(error as Error)?.message || String(error)}`,
                {
                    error: (error as Error)?.stack,
                    requestId,
                    scan,
                },
            );
            this.mainWindow?.webContents.send("picasa:find-photo", {
                type: "error",
                requestId,
                error,
            });
        }
    }
}
