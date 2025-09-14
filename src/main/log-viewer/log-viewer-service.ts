import type { IpcMain, BrowserWindow } from "electron";
import { globalShortcut } from "electron";
import { globalLogInterceptor, type LogEntry } from "@common/logger";
import { loggers } from "@common/logger";

const logger = loggers.main;

export default class LogViewerService {
    private isActive = false;
    private unsubscribe?: () => void;
    private mainWindow: BrowserWindow;
    private workers = new Set<any>();

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;

        // IPC处理器
        ipcMain.handle("log:viewer-open", () => {
            return this.activateLogViewer();
        });

        ipcMain.handle("log:viewer-close", () => {
            return this.deactivateLogViewer();
        });

        // 处理Worker日志
        ipcMain.on("worker:log", (_, entry: LogEntry) => {
            if (this.isActive) {
                // 转发给前端
                mainWindow.webContents.send("log:entry", entry);
            }
        });

        // 注册全局快捷键
        this.registerGlobalShortcut();

        logger.info("[LogViewerService] initialized");
    }

    private activateLogViewer() {
        if (this.isActive) {
            return { success: true, message: "[LogViewerService] Log viewer already active" };
        }

        try {
            this.isActive = true;

            // 激活 main 进程的日志拦截器
            globalLogInterceptor.activate();

            // 订阅 main 进程的日志流
            this.unsubscribe = globalLogInterceptor.subscribe((entry) => {
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send("log:entry", entry);
                }
            });

            // 通知所有worker开始收集日志
            this.notifyWorkers(true);

            logger.info("[LogViewerService] Log viewer activated");
            return { success: true, message: "[LogViewerService] Log viewer activated" };
        } catch (error) {
            logger.error("[LogViewerService] Failed to activate log viewer:", error);
            return { success: false, message: "[LogViewerService] Failed to activate log viewer" };
        }
    }

    private deactivateLogViewer() {
        if (!this.isActive) {
            return { success: true, message: "[LogViewerService] Log viewer already inactive" };
        }

        try {
            this.cleanup();
            logger.info("[LogViewerService] Log viewer deactivated");
            return { success: true, message: "[LogViewerService] Log viewer deactivated" };
        } catch (error) {
            logger.error("[LogViewerService] Failed to deactivate log viewer:", error);
            return {
                success: false,
                message: "[LogViewerService] Failed to deactivate log viewer",
            };
        }
    }

    private cleanup() {
        if (!this.isActive) return;

        this.isActive = false;

        // 停止日志拦截
        globalLogInterceptor.deactivate();

        // 取消订阅
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = undefined;
        }

        // 通知所有worker停止收集日志
        this.notifyWorkers(false);
    }

    private notifyWorkers(active: boolean) {
        // 通知所有注册的worker线程
        this.workers.forEach((worker) => {
            if (worker && worker.postMessage) {
                worker.postMessage({
                    type: "log:viewer-status",
                    active,
                });
            }
        });
    }

    // 注册worker以便通知日志状态
    registerWorker(worker: any) {
        this.workers.add(worker);

        // 如果日志查看器已激活，立即通知该worker
        if (this.isActive) {
            worker.postMessage({
                type: "log:viewer-status",
                active: true,
            });
        }

        // 当worker终止时移除
        worker.on("exit", () => {
            this.workers.delete(worker);
        });
    }

    // 注销worker
    unregisterWorker(worker: any) {
        this.workers.delete(worker);
    }

    private registerGlobalShortcut() {
        try {
            // 注册全局快捷键 Cmd+Shift+Option+L (Mac) / Ctrl+Shift+Alt+L (Windows/Linux)
            const shortcut = process.platform === "darwin" ? "Cmd+Shift+Alt+L" : "Ctrl+Shift+Alt+L";

            const registered = globalShortcut.register(shortcut, () => {
                logger.debug("[LogViewerService] Global shortcut triggered for log viewer");
                // 发送消息到渲染进程触发日志查看器
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send("log:toggle-viewer");
                }
            });

            if (registered) {
                logger.info(
                    `[LogViewerService] Log viewer global shortcut registered: ${shortcut}`,
                );
            } else {
                logger.warn(`[LogViewerService] Failed to register global shortcut: ${shortcut}`);
            }
        } catch (error) {
            logger.error("[LogViewerService] Failed to register global shortcut:", error);
        }
    }

    // 清理资源
    destroy() {
        this.cleanup();
        this.workers.clear();

        // 注销全局快捷键
        globalShortcut.unregisterAll();
    }
}
