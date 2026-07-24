import { loggers } from "@photasa/common";
import { WatchServiceEvent, type WatchConfig } from "@photasa/common";
import type { FileOperation } from "@photasa/common";
import { createFileOperation } from "@photasa/common";
import {
    createShunfengerEngine,
    type ShunfengerCommand,
    type ShunfengerEngine,
    type ShunfengerEngineEvent,
} from "@photasa/shunfenger";
import type { IpcMain, IpcMainEvent, BrowserWindow } from "electron";
import { Service } from "@main/tianting/decorators/service-decorators";
import { ServicePriority, IService } from "@main/tianting/core/service-types";
import isDev from "electron-is-dev";

/** 桌面端默认监听 profile，与 IPC WatchConfig 一一对应 */
const DESKTOP_WATCH_PROFILE_ID = "desktop-watch";

/** 批量发送扫描队列的 IPC 通道 */
const SCAN_QUEUE_CHANNEL = "picasa:add-to-scan-queue";

/**
 * WatchService 是薄壳：将 IPC 映射到顺风耳引擎，Phase 1 继续 mirror 到扫描队列。
 */
@Service({
    name: "watch",
    displayName: "文件监视服务",
    priority: ServicePriority.Critical,
    startupDelay: isDev ? 1000 : 0,
    lazyLoad: false,
    description: "监视文件系统变化",
})
export default class WatchService implements IService {
    readonly name = "watch";
    ipc: IpcMain;
    mainWindow: BrowserWindow;
    logger = loggers.watch;

    private readonly engine: ShunfengerEngine = createShunfengerEngine();
    private unsubscribeEngineEvents: (() => void) | null = null;
    private pendingOperations: FileOperation[] = [];
    private batchTimer: NodeJS.Timeout | null = null;

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;
    }

    async initialize(): Promise<void> {
        await this.engine.initialize();
        this.engine.setCommandDispatcher((command) => this.handleEngineCommand(command));
        this.unsubscribeEngineEvents = this.engine.onEvent((event) =>
            this.handleEngineEvent(event),
        );

        this.ipc.handle("picasa:stop-file-watch", async () => {
            this.logger.info("Stop watching files......");
            await this.engine.pause();
        });

        this.ipc.on(WatchServiceEvent.start, async (_event: IpcMainEvent, args: WatchConfig) => {
            await this.startWatching(args);
        });

        this.logger.info("[WatchService] 文件监视服务已初始化（顺风耳引擎）");
    }

    private async startWatching(args: WatchConfig): Promise<void> {
        this.logger.info("Start watching files: ", args.paths);

        const now = Date.now();
        await this.engine.startWatching({
            paths: args.paths,
            options: args.options,
            profile: {
                id: DESKTOP_WATCH_PROFILE_ID,
                rootPath: args.paths[0] ?? "",
                recursive: true,
                ignoreGlobs: [],
                thumbnailSize: 150,
                autoStart: true,
                priority: "background",
                createdAt: now,
                updatedAt: now,
            },
        });
    }

    private handleEngineCommand(command: ShunfengerCommand): void {
        if (command.type === "file-operation") {
            this.pendingOperations.push(command.payload.operation);
            this.scheduleBatchSend();
            return;
        }

        const operationType =
            command.payload.action.operationType === "directory" ? "addDir" : "add";
        const operation = createFileOperation(
            operationType,
            command.payload.action.path,
            command.payload.action.operationType !== "directory",
            command.payload.action.thumbnailSize,
        );
        this.pendingOperations.push(operation);
        this.scheduleBatchSend();
    }

    private handleEngineEvent(event: ShunfengerEngineEvent): void {
        if (event.type !== "status") {
            return;
        }

        if (event.state === "ready") {
            this.mainWindow?.webContents.send(WatchServiceEvent.ready, {});
            return;
        }

        if (event.state === "error" && event.error) {
            this.mainWindow?.webContents.send(WatchServiceEvent.error, { error: event.error });
        }
    }

    private scheduleBatchSend(): void {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }

        this.batchTimer = setTimeout(() => {
            this.flushPendingOperations();
        }, 200);
    }

    private flushPendingOperations(): void {
        if (this.pendingOperations.length === 0) {
            return;
        }

        const operations = [...this.pendingOperations];
        this.pendingOperations = [];
        this.logger.info(`Processing ${operations.length} file operations`);
        this.mainWindow?.webContents.send(SCAN_QUEUE_CHANNEL, operations);
    }

    async shutdown(): Promise<void> {
        this.ipc.removeAllListeners(WatchServiceEvent.start);
        this.ipc.removeHandler("picasa:stop-file-watch");

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        this.flushPendingOperations();
        this.unsubscribeEngineEvents?.();
        this.unsubscribeEngineEvents = null;
        await this.engine.shutdown();

        this.logger.info("[WatchService] 文件监视服务已关闭");
    }
}
