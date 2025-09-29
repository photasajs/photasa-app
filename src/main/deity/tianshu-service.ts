/**
 * 天枢服务 - 托管天枢引擎
 * 作为Electron服务运行，处理工作流编排和意图管理
 */

import { type IpcMain, BrowserWindow } from "electron";
import { Service } from "@main/tianting/decorators/service-decorators";
import { ServicePriority, IService } from "@main/tianting/core/service-types";
import { TianshuEngine } from "../../engines/tianshu/core/TianshuEngine";

@Service({
    name: "tianshu",
    displayName: "天枢编排服务",
    priority: ServicePriority.Critical,
    description: "托管天枢引擎，处理工作流编排和意图管理",
    dependencies: [],
    retryOnFailure: true,
    maxRetries: 3,
})
export default class TianshuService implements IService {
    readonly name = "tianshu";
    private tianshuEngine!: TianshuEngine;

    constructor(
        private ipcMain: IpcMain,
        private mainWindow: BrowserWindow,
    ) {}

    /**
     * 初始化天枢服务
     */
    async initialize(): Promise<void> {
        // 创建天枢引擎实例，配置工作流目录
        this.tianshuEngine = new TianshuEngine({
            workflowDir: "src/engines/tianshu/workflows",
            maxConcurrentWorkflows: 5,
            defaultTimeout: 30000,
            enableHotReload: true,
        });

        await this.tianshuEngine.initialize();

        // 注册IPC处理器
        this.setupIpcHandlers();
    }

    /**
     * 关闭天枢服务
     */
    async shutdown(): Promise<void> {
        if (this.tianshuEngine) {
            await this.tianshuEngine.shutdown();
        }
    }

    /**
     * 设置IPC处理器
     */
    private setupIpcHandlers(): void {
        // 天枢命令处理IPC
        this.ipcMain.handle("tianshu.command", async (_, command) => {
            return this.tianshuEngine.processCommand(command);
        });

        // 天枢状态查询IPC
        this.ipcMain.handle("tianshu.status", async () => {
            return this.tianshuEngine.getSystemStatus();
        });

        // 监听天枢引擎事件并广播给渲染进程
        this.tianshuEngine.on("progress", (progress) => {
            this.mainWindow.webContents.send("tianshu.progress", progress);
        });

        this.tianshuEngine.on("status", (status) => {
            this.mainWindow.webContents.send("tianshu.status", status);
        });
    }
}
