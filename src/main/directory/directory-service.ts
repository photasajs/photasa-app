import type { IpcMain, BrowserWindow, App } from "electron";
import { dialog } from "electron";
import * as fs from "fs";
import * as path from "path";
import { readFile } from "fs/promises";
import klawSync from "klaw-sync";
import { Service } from "../services/decorators/service-decorators";
import { ServicePriority, IService, ServiceStatus } from "../services/core/service-types";
import { loggers } from "@common/logger";

const logger = loggers.main;

@Service({
    name: "directory",
    displayName: "目录服务",
    priority: ServicePriority.Critical,
    lazyLoad: false,
    description: "提供目录和文件系统相关的 IPC 操作",
})
export default class DirectoryService implements IService {
    readonly name = "directory";
    private ipcMain: IpcMain;
    private mainWindow: BrowserWindow;
    private app: App;

    constructor(
        ipcMain: IpcMain,
        mainWindow: BrowserWindow,
        app: App,
        _dependencies?: Map<string, any>,
    ) {
        this.ipcMain = ipcMain;
        this.mainWindow = mainWindow;
        this.app = app;
    }

    /**
     * 初始化目录服务
     */
    async initialize(): Promise<void> {
        logger.info("[DirectoryService] 初始化目录服务");

        // 注册 IPC 处理器
        this.setupIpcHandlers();

        logger.info("[DirectoryService] 目录服务初始化完成");
    }

    /**
     * 关闭目录服务
     */
    async shutdown(): Promise<void> {
        logger.info("[DirectoryService] 关闭目录服务");
        // 移除 IPC 处理器
        this.ipcMain.removeAllListeners("picasa:choose-directory");
    }

    /**
     * 获取服务状态
     */
    getStatus(): ServiceStatus {
        return {
            running: true,
            healthy: true,
        };
    }

    /**
     * 设置 IPC 处理器
     */
    private setupIpcHandlers(): void {
        // 获取系统目录 - Critical 功能，应用启动时需要
        this.ipcMain.handle("picasa:get-directory", async (_, args) => {
            return this.app.getPath(args.name);
        });

        // 选择目录对话框
        this.ipcMain.on("picasa:choose-directory", () => {
            if (this.mainWindow) {
                dialog
                    .showOpenDialog(this.mainWindow, {
                        properties: ["openDirectory"],
                    })
                    .then(({ filePaths }) => {
                        this.mainWindow?.webContents.send("picasa:selected-directory", {
                            filePaths,
                        });
                    })
                    .catch((err) => {
                        logger.error("目录选择失败:", err);
                    });
            }
        });

        // 检查文件夹是否有有效的 photasa.json 配置
        this.ipcMain.handle("picasa:check-photasa-config", async (_, folderPath) => {
            try {
                const configPath = path.join(folderPath, ".photasa.json");
                if (!fs.existsSync(configPath)) {
                    return { hasConfig: false, reason: "配置文件不存在" };
                }

                const configContent = await readFile(configPath, "utf8");
                const config = JSON.parse(configContent);

                // 验证配置文件的基本结构
                if (!config || typeof config !== "object") {
                    return { hasConfig: false, reason: "配置文件格式错误" };
                }

                // 检查是否有照片计数信息
                const photoCount = config.photoCount || 0;

                return {
                    hasConfig: true,
                    photoCount,
                    reason: "配置文件有效",
                };
            } catch (error) {
                logger.error(`检查配置文件失败 [${folderPath}]:`, error);
                return { hasConfig: false, reason: "配置文件读取失败" };
            }
        });

        // 扫描子文件夹
        this.ipcMain.handle("picasa:sub-folders", async (_, args) => {
            try {
                const filterFn = (item: { path: string }): boolean => {
                    const basename = path.basename(item.path);
                    return basename === "." || basename[0] !== ".";
                };

                if (!fs.existsSync(args.parent)) {
                    const error = new Error(`目录不存在: ${args.parent}`);
                    logger.warn(error.message);
                    throw error;
                }

                const folders = klawSync(args.parent, {
                    nofile: true,
                    depthLimit: 0,
                    filter: filterFn,
                    errorCallback: (err: Error) => {
                        logger.error(`扫描目录错误 ${args.parent}:`, err);
                    },
                });

                return folders.map((item) => item.path);
            } catch (error) {
                logger.error(`picasa:sub-folders 处理器错误:`, error);
                throw error;
            }
        });

        logger.info("[DirectoryService] IPC 处理器注册完成");
    }
}
