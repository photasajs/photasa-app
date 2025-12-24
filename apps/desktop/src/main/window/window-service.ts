import { loggers } from "@common/logger";
import type { IpcMain, BrowserWindow, App } from "electron";
import { Service } from "@main/tianting/decorators/service-decorators";
import { ServicePriority, IService } from "@main/tianting/core/service-types";

@Service({
    name: "window",
    displayName: "窗口服务",
    priority: ServicePriority.Critical,
    dependencies: ["config"],
    lazyLoad: false,
    description: "管理应用窗口的创建和控制",
})
export default class WindowService implements IService {
    readonly name = "window";
    ipc: IpcMain;
    mainWindow: BrowserWindow;
    logger = loggers.window;
    app: App;

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow, app: App) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;
        this.app = app;
    }

    /**
     * 初始化窗口服务
     */
    async initialize(): Promise<void> {
        this.init();
    }

    /**
     * 关闭窗口服务
     */
    async shutdown(): Promise<void> {
        // 清理 IPC 监听器
        this.ipc.removeAllListeners("window:minimize");
        this.ipc.removeAllListeners("window:maximize");
        this.ipc.removeAllListeners("window:unmaximize");
        this.ipc.removeAllListeners("window:close");
        this.ipc.removeAllListeners("window:queryMaximized");
        this.ipc.removeAllListeners("window:reload");
    }

    private init(): void {
        // ========== 新增窗口控制相关 IPC 事件监听 ==========
        this.ipc.on("window:minimize", () => {
            this.logger.info("window:minimize");
            this.mainWindow?.minimize();
        });
        this.ipc.on("window:maximize", () => {
            this.logger.info("window:maximize");
            if (this.mainWindow?.isDestroyed()) {
                this.logger.error("window:maximize: window is destroyed");
                return;
            }
            this.mainWindow?.maximize();
        });
        this.ipc.on("window:unmaximize", () => {
            this.logger.info("window:unmaximize");
            this.mainWindow?.unmaximize();
        });
        this.ipc.on("window:close", () => {
            this.logger.info("window:close");
            this.mainWindow?.close();
            this.app.quit();
        });
        this.ipc.on("window:queryMaximized", () => {
            this.logger.info("window:queryMaximized");
            this.mainWindow?.webContents.send(
                "window:maximizedState",
                this.mainWindow?.isMaximized() ?? false,
            );
        });
        // 窗口最大化/还原时主动通知渲染进程
        this.mainWindow?.on("maximize", () => {
            this.logger.info("window:maximize");
            this.mainWindow?.webContents.send("window:maximized");
        });
        this.mainWindow?.on("unmaximize", () => {
            this.logger.info("window:unmaximize");
            this.mainWindow?.webContents.send("window:unmaximized");
        });
    }
}
