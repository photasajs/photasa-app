import { loggers } from "@photasa/common";
import { WatchServiceEvent, type WatchConfig } from "@photasa/common";
import type { FileOperation } from "@photasa/common";
import { EventLossPreventionConfig } from "@photasa/common";
import {
    createFileOperation,
    getDeduplicationWindow,
    calculateDebounceTime,
    shouldDeduplicateEvent,
} from "@photasa/common";
import chokidar, { type FSWatcher } from "chokidar";
import type { IpcMain, IpcMainEvent, BrowserWindow } from "electron";
import { Service } from "@main/tianting/decorators/service-decorators";
import { ServicePriority, IService } from "@main/tianting/core/service-types";
import isDev from "electron-is-dev";

/**
 * WatchService is a CRITICAL core service that must start immediately with the app.
 *
 * Why this service is Critical:
 * 1. File watching is the primary feature - users expect real-time updates when files change
 * 2. Must be active from app start to catch all file system events
 * 3. Other features depend on file change notifications (thumbnails, UI updates, etc.)
 * 4. Any delay or lazy loading would cause missed file events and poor user experience
 *
 * Environment-based configuration:
 * - Production: Critical priority, no delay - must start immediately for core functionality
 * - Development: Slight delay to improve startup performance during development
 *
 * Configuration rationale:
 * - Priority.Critical: Ensures first initialization with other core services
 * - startupDelay: Environment-based - 0 for production, small delay for dev
 * - lazyLoad: false: Always auto-initialize, never wait for explicit request
 *
 * IMPORTANT: Do NOT change these settings without understanding the impact on core functionality
 */
@Service({
    name: "watch",
    displayName: "文件监视服务",
    priority: ServicePriority.Critical,
    startupDelay: isDev ? 1000 : 0, // 开发环境延迟1秒，生产环境立即启动
    lazyLoad: false, // 自动加载
    description: "监视文件系统变化",
})
export default class WatchService implements IService {
    readonly name = "watch";
    ipc: IpcMain;
    mainWindow: BrowserWindow;
    FileWatcherHandler: FSWatcher | undefined;
    logger = loggers.watch;

    // Event deduplication and batching
    private pendingEvents = new Map<string, FileOperation>();
    private debounceTimer: NodeJS.Timeout | null = null;
    private currentThumbnailSize = 150;

    // Event loss prevention mechanisms
    private eventLossPrevention = {
        maxPendingEvents: EventLossPreventionConfig.MaxPendingEvents,
        forceProcessInterval: EventLossPreventionConfig.ForceProcessInterval,
        lastForceProcess: 0,

        shouldForceProcess(): boolean {
            const now = Date.now();
            return now - this.lastForceProcess > this.forceProcessInterval;
        },

        isNearLimit(pendingCount: number): boolean {
            return pendingCount > this.maxPendingEvents * 0.8;
        },
    };

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;
    }

    /**
     * 初始化文件监视服务
     */
    async initialize(): Promise<void> {
        // Stop watching files
        this.ipc.handle("picasa:stop-file-watch", async () => {
            this.logger.info("Stop watching files......");
            if (this.FileWatcherHandler) {
                try {
                    await this.FileWatcherHandler.close();
                    this.FileWatcherHandler = undefined;
                } catch (error) {
                    this.logger.warn("[WatchService] 停止文件监听时出错:", error);
                }
            }
        });

        // Start watching files
        this.ipc.on(WatchServiceEvent.start, async (_event: IpcMainEvent, args: WatchConfig) => {
            await this.startWatching(args);
        });

        this.logger.info("[WatchService] 文件监视服务已初始化");
    }

    private async startWatching(args: WatchConfig): Promise<void> {
        this.logger.info("Start watching files: ", args.paths);
        // ✅ 修复：等待之前的监听器完全关闭，避免资源泄漏
        if (this.FileWatcherHandler) {
            try {
                await this.FileWatcherHandler.close();
            } catch (error) {
                this.logger.warn("[WatchService] 关闭之前的文件监听器时出错:", error);
            }
        }
        // Create a new watcher
        this.FileWatcherHandler = chokidar.watch(args.paths, args.options);

        // All events go through unified processing with deduplication and batching
        this.FileWatcherHandler.on("add", (path) => this.handleFileEvent("add", path, true))
            .on("addDir", (path) => this.handleFileEvent("addDir", path, false))
            .on("change", (path) => this.handleFileEvent("change", path, true))
            .on("unlink", (path) => this.handleFileEvent("delete", path, true))
            .on("unlinkDir", (path) => this.handleFileEvent("deleteDir", path, false))
            .on("error", (error) => {
                this.mainWindow?.webContents.send(WatchServiceEvent.error, { error });
            })
            .on("ready", () => {
                this.mainWindow?.webContents.send(WatchServiceEvent.ready, {});
            });
    }

    private handleFileEvent(type: string, path: string, isFile = true): void {
        const key = `${type}:${path}`;
        const now = Date.now();

        this.logger.info(`File event: ${type} ${path}`);

        // Smart deduplication using pure functions
        const existing = this.pendingEvents.get(key);
        const dedupWindow = getDeduplicationWindow(type);

        if (shouldDeduplicateEvent(existing, now, dedupWindow)) {
            // Update existing event with latest timestamp and metadata
            if (existing) {
                existing.timestamp = now;
                if (existing.metadata) {
                    existing.metadata.lastModified = now;
                }
                this.logger.debug(
                    `Updated existing event: ${key} (${now - existing.timestamp}ms ago)`,
                );
            }
            return;
        }

        // Create new operation using pure function
        const operation = createFileOperation(type, path, isFile, this.currentThumbnailSize);
        this.pendingEvents.set(key, operation);

        // Check for force processing to prevent event loss
        this.forceProcessIfNeeded();

        // Start debounced processing
        this.debounceProcess();
    }

    private debounceProcess(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Dynamic debounce based on event load using pure function
        const pendingCount = this.pendingEvents.size;
        const debounceTime = calculateDebounceTime(pendingCount);

        this.debounceTimer = setTimeout(() => {
            this.processPendingEvents();
        }, debounceTime);
    }

    private processPendingEvents(): void {
        const operations = Array.from(this.pendingEvents.values());
        this.pendingEvents.clear();

        if (operations.length > 0) {
            this.logger.info(`Processing ${operations.length} file operations`);
            this.mainWindow?.webContents.send("picasa:add-to-scan-queue", operations);
        }

        // Update force process timestamp
        this.eventLossPrevention.lastForceProcess = Date.now();
    }

    // Force process events to prevent loss
    private forceProcessIfNeeded(): void {
        const pendingCount = this.pendingEvents.size;

        if (
            this.eventLossPrevention.shouldForceProcess() ||
            this.eventLossPrevention.isNearLimit(pendingCount)
        ) {
            this.logger.warn(`Force processing ${pendingCount} events to prevent loss`);
            this.processPendingEvents();
        }
    }

    /**
     * 关闭文件监视服务
     */
    async shutdown(): Promise<void> {
        this.ipc.removeAllListeners(WatchServiceEvent.start);
        this.ipc.removeHandler("picasa:stop-file-watch");

        // Clean up debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        // Process any remaining events before closing
        if (this.pendingEvents.size > 0) {
            this.logger.info(`Processing ${this.pendingEvents.size} remaining events before close`);
            this.processPendingEvents();
        }

        // ✅ 修复：等待文件监听器完全关闭，避免应用关闭时的竞态条件
        if (this.FileWatcherHandler) {
            try {
                await this.FileWatcherHandler.close();
            } catch (error) {
                this.logger.warn("[WatchService] 关闭文件监听器时出错:", error);
            }
            this.FileWatcherHandler = undefined;
        }

        this.logger.info("[WatchService] 文件监视服务已关闭");
    }
}
