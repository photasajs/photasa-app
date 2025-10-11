import { loggers } from "@common/logger";
import type { BrowserWindow, IpcMain } from "electron";
import { shell } from "electron";
import { Service } from "../services/decorators/service-decorators";
import { ServicePriority, IService } from "../services/core/service-types";

const logger = loggers.shell;

@Service({
    name: "shell",
    displayName: "Shell 服务",
    priority: ServicePriority.Critical,
    lazyLoad: false,
    description: "提供系统 Shell 交互功能",
})
export default class ShellService implements IService {
    readonly name = "shell";
    ipc: IpcMain;
    mainWindow: BrowserWindow;

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;
    }

    /**
     * 初始化 Shell 服务
     */
    async initialize(): Promise<void> {
        this.init();
        logger.info("[ShellService] initialized");
    }

    /**
     * 关闭 Shell 服务
     */
    async shutdown(): Promise<void> {
        // 清理 IPC 监听器
        this.ipc.removeAllListeners("picasa:open-in-finder");
        this.ipc.removeHandler("shell:openExternal");
        logger.info("[ShellService] shut down");
    }

    private init(): void {
        // Open in finder
        this.ipc.on("picasa:open-in-finder", (_, args) => {
            logger.info(`picasa:open-in-finder: path=${args.path}`);
            shell.showItemInFolder(args.path);
        });

        // Open external
        this.ipc.handle("shell:openExternal", (_, url: string) => {
            shell.openExternal(url);
        });
    }
}
