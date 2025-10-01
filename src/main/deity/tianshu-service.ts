/**
 * 天枢服务 - 天枢星君化身
 * 作为天庭编排神祇，掌管工作流编排，协调诸天引擎，处理用户意图
 *
 * 神话背景：
 * 天枢星君，北斗七星之首，乃紫微大帝座下重要星君
 * 掌管天庭工作流程编排，协调诸天万界的事务流转
 * 以智慧著称，善于理解用户意图，制定最优执行方案
 * 负责将复杂任务分解为可执行的步骤，确保天庭高效运转
 *
 * 核心能力：
 * - 意图理解：解析用户需求，转化为可执行的工作流
 * - 流程编排：将复杂任务分解为有序的执行步骤
 * - 协调调度：统筹各引擎资源，优化执行效率
 * - 状态管理：监控执行过程，确保任务顺利完成
 */

import { type IpcMain, BrowserWindow } from "electron";
import { Service } from "@main/tianting/decorators/service-decorators";
import { ServicePriority, IService } from "@main/tianting/core/service-types";
import { TianshuEngine } from "../../engines/tianshu/core/TianshuEngine";
import { loggers } from "@common/logger";
import type TaiyiService from "./taiyi-service";
import { IStepExecutor } from "@engines/common/interfaces";

const logger = loggers.tianshu || loggers.main;

@Service({
    name: "tianshu",
    displayName: "天枢星君",
    priority: ServicePriority.Critical,
    description: "天枢星君化身，掌管工作流编排，协调诸天引擎，处理用户意图，确保天庭高效运转",
    dependencies: ["taiyi"], // 天枢依赖太乙进行引擎协调
    retryOnFailure: true,
    maxRetries: 3,
})
export default class TianshuService implements IService {
    readonly name = "tianshu";
    private tianshuEngine!: TianshuEngine;
    private taiyiService!: TaiyiService;

    constructor(
        private ipcMain: IpcMain,
        private mainWindow: BrowserWindow,
        _: Electron.App,
        dependencies: Record<string, any>,
    ) {
        if (dependencies?.has("taiyi")) {
            this.taiyiService = dependencies.get("taiyi") as TaiyiService;
        } else {
            throw new Error("taiyi service not found");
        }
    }

    /**
     * 初始化天枢星君
     * 唤醒天枢星君，建立工作流编排体系
     */
    async initialize(): Promise<void> {
        // 创建天枢引擎实例，传入太乙服务作为步骤执行器
        this.tianshuEngine = new TianshuEngine({
            workflowDir: "src/engines/tianshu/workflows",
            maxConcurrentWorkflows: 5,
            defaultTimeout: 30000,
            enableHotReload: false,
            stepExecutor: this.taiyiService as IStepExecutor,
        });

        await this.tianshuEngine.initialize();

        // 注册IPC处理器
        this.setupIpcHandlers();
        logger.info("天枢服务已初始化");
    }

    /**
     * 关闭天枢星君
     * 让天枢星君进入休眠状态，保存当前状态
     */
    async shutdown(): Promise<void> {
        if (this.tianshuEngine) {
            await this.tianshuEngine.shutdown();
        }
    }

    /**
     * 设置天枢星君的通信渠道
     * 建立与渲染进程的通信桥梁，处理各种天庭事务
     */
    private setupIpcHandlers(): void {
        // 天枢星君命令处理 - 接收天庭指令
        this.ipcMain.handle("tianshu.command", async (_, command) => {
            return this.tianshuEngine.processCommand(command);
        });

        // 天枢星君状态查询 - 汇报天庭运转状况
        this.ipcMain.handle("tianshu.status", async () => {
            return this.tianshuEngine.getSystemStatus();
        });

        // 监听天枢星君事件并广播给渲染进程
        this.tianshuEngine.on("progress", (progress) => {
            this.mainWindow.webContents.send("tianshu.progress", progress);
        });

        this.tianshuEngine.on("status", (status) => {
            this.mainWindow.webContents.send("tianshu.status", status);
        });

        logger.info("天枢星君IPC处理器已设置");
    }
}
