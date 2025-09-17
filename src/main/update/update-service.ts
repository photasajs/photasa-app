import { autoUpdater, UpdateInfo } from "electron-updater";
import type { IpcMain, BrowserWindow } from "electron";
import { loggers } from "@common/logger";
import type { AutoUpdateConfig, UpdateStatus, UpdateProgressInfo } from "@common/update-types";

const logger = loggers.update;
/**
 * 自动更新服务
 * 集成electron-updater，提供完整的自动更新功能
 */
export default class UpdateService {
    private ipc: IpcMain;
    private mainWindow: BrowserWindow;
    private config: AutoUpdateConfig | null = null;
    private currentStatus: UpdateStatus = "idle";
    private downloadProgress = 0;
    private lastError: string | null = null;
    private latestUpdateInfo: UpdateInfo | null = null;
    private checkTimer: NodeJS.Timeout | null = null;

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;

        // 配置autoUpdater
        this.setupAutoUpdater();

        // 注册IPC处理器
        this.registerIpcHandlers();

        logger.info("[UpdateService] 自动更新服务已初始化");
    }

    /**
     * 初始化配置和启动定时检查
     */
    async initialize(config: AutoUpdateConfig): Promise<void> {
        this.config = config;

        // 应用配置到autoUpdater
        this.applyConfig();

        // 启动定时检查
        if (config.enabled) {
            this.startPeriodicCheck();
            // 立即执行一次检查（延迟5秒以避免启动时的性能问题）
            setTimeout(() => {
                this.checkForUpdates();
            }, 5000);
        }

        logger.info(
            `[UpdateService] 服务已初始化: enabled=${config.enabled}, checkInterval=${config.checkInterval}h`,
        );
    }

    /**
     * 更新配置
     */
    updateConfig(newConfig: Partial<AutoUpdateConfig>): void {
        if (!this.config) {
            logger.warn("[UpdateService] 配置尚未初始化");
            return;
        }

        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };

        // 重新应用配置
        this.applyConfig();

        // 重启定时检查（如果启用状态有变化）
        if (oldConfig.enabled !== this.config.enabled) {
            if (this.config.enabled) {
                this.startPeriodicCheck();
            } else {
                this.stopPeriodicCheck();
            }
        }

        // 如果检查间隔有变化，重启定时器
        if (oldConfig.checkInterval !== this.config.checkInterval && this.config.enabled) {
            this.restartPeriodicCheck();
        }

        logger.info(`[UpdateService] 配置已更新: ${JSON.stringify(newConfig)}`);
    }

    /**
     * 手动检查更新
     */
    async checkForUpdates(): Promise<{ hasUpdate: boolean; version?: string; info?: UpdateInfo }> {
        if (this.currentStatus === "checking") {
            logger.warn("[UpdateService] 更新检查已在进行中");
            return { hasUpdate: false };
        }

        try {
            this.setStatus("checking");
            logger.info("[UpdateService] 开始检查更新");

            const updateCheckResult = await autoUpdater.checkForUpdatesAndNotify();

            if (updateCheckResult && updateCheckResult.updateInfo) {
                const updateInfo = updateCheckResult.updateInfo;
                this.latestUpdateInfo = updateInfo;

                // 检查是否为新版本
                const currentVersion = autoUpdater.currentVersion;
                const hasUpdate = updateInfo.version !== currentVersion.version;

                if (hasUpdate) {
                    logger.info(
                        `[UpdateService] 发现新版本: ${currentVersion.version} -> ${updateInfo.version}`,
                    );

                    this.setStatus("idle");
                    this.notifyRenderer("available", {
                        version: updateInfo.version,
                        info: updateInfo,
                    });

                    // 如果启用自动下载，开始下载
                    if (this.config?.autoInstall) {
                        setTimeout(() => {
                            this.downloadUpdate();
                        }, 1000);
                    }

                    return { hasUpdate: true, version: updateInfo.version, info: updateInfo };
                } else {
                    this.setStatus("upToDate");
                    logger.info("[UpdateService] 当前版本已是最新");
                    return { hasUpdate: false };
                }
            } else {
                this.setStatus("upToDate");
                return { hasUpdate: false };
            }
        } catch (error) {
            const errorMessage = this.handleError(error);
            this.setStatus("error", errorMessage);
            logger.error(`[UpdateService] 检查更新失败: ${errorMessage}`);
            throw new Error(errorMessage);
        }
    }

    /**
     * 下载更新
     */
    async downloadUpdate(): Promise<void> {
        if (!this.latestUpdateInfo) {
            throw new Error("没有可用的更新信息");
        }

        if (this.currentStatus === "downloading") {
            logger.warn("[UpdateService] 更新下载已在进行中");
            return;
        }

        try {
            this.setStatus("downloading");
            logger.info("[UpdateService] 开始下载更新");

            await autoUpdater.downloadUpdate();
        } catch (error) {
            const errorMessage = this.handleError(error);
            this.setStatus("error", errorMessage);
            logger.error(`[UpdateService] 下载更新失败: ${errorMessage}`);
            throw new Error(errorMessage);
        }
    }

    /**
     * 安装更新并重启应用
     */
    quitAndInstall(): void {
        if (this.currentStatus !== "downloaded") {
            throw new Error("没有已下载的更新可以安装");
        }

        logger.info("[UpdateService] 开始安装更新并重启应用");
        autoUpdater.quitAndInstall();
    }

    /**
     * 获取当前状态
     */
    getStatus(): UpdateProgressInfo {
        return {
            status: this.currentStatus,
            progress: this.downloadProgress,
            error: this.lastError || undefined,
            version: this.latestUpdateInfo?.version,
            info: this.latestUpdateInfo || undefined,
        };
    }

    /**
     * 获取应用版本
     */
    getAppVersion(): string {
        return autoUpdater.currentVersion.version;
    }

    /**
     * 配置autoUpdater
     */
    private setupAutoUpdater(): void {
        // 使用配置文件驱动，不调用setFeedURL
        // 开发环境：自动读取 dev-app-update.yml
        // 生产环境：自动读取内嵌的 app-update.yml (由 electron-builder.yml 生成)

        // 禁用自动下载，我们手动控制
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = false;

        // 事件监听
        autoUpdater.on("checking-for-update", () => {
            logger.info("[UpdateService] 正在检查更新...");
        });

        autoUpdater.on("update-available", (info: UpdateInfo) => {
            logger.info(
                `[UpdateService] 发现可用更新: ${info.version}, releaseDate: ${info.releaseDate}`,
            );
        });

        autoUpdater.on("update-not-available", (info: UpdateInfo) => {
            logger.info(`[UpdateService] 没有可用更新: 当前版本 ${info.version} 已是最新`);
        });

        autoUpdater.on("error", (error) => {
            const errorMessage = this.handleError(error);
            this.setStatus("error", errorMessage);
            logger.error(`[UpdateService] 更新错误: ${errorMessage}`);
        });

        autoUpdater.on("download-progress", (progressObj) => {
            this.downloadProgress = Math.round(progressObj.percent);
            this.notifyRenderer("progress", this.downloadProgress);
            logger.info(`[UpdateService] 下载进度: ${this.downloadProgress}%`);
        });

        autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
            this.setStatus("downloaded");
            this.notifyRenderer("downloaded", info);
            logger.info(`[UpdateService] 更新下载完成: ${info.version}`);
        });
    }

    /**
     * 应用配置到autoUpdater
     */
    private applyConfig(): void {
        if (!this.config) return;

        // 设置是否允许预发布版本
        autoUpdater.allowPrerelease = this.config.allowPrerelease;

        logger.info(`[UpdateService] 配置已应用: allowPrerelease=${this.config.allowPrerelease}`);
    }

    /**
     * 启动定时检查
     */
    private startPeriodicCheck(): void {
        if (!this.config?.enabled) return;

        this.stopPeriodicCheck(); // 确保清除旧的定时器

        const intervalMs = this.config.checkInterval * 60 * 60 * 1000; // 转换为毫秒
        this.checkTimer = setInterval(() => {
            this.checkForUpdates().catch((error) => {
                const errorMessage = this.handleError(error);
                logger.error(`[UpdateService] 定时检查更新失败: ${errorMessage}`);
            });
        }, intervalMs);

        logger.info(`[UpdateService] 定时检查已启动: 间隔${this.config.checkInterval}小时`);
    }

    /**
     * 停止定时检查
     */
    private stopPeriodicCheck(): void {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
            logger.info("[UpdateService] 定时检查已停止");
        }
    }

    /**
     * 重启定时检查
     */
    private restartPeriodicCheck(): void {
        this.stopPeriodicCheck();
        this.startPeriodicCheck();
    }

    /**
     * 设置状态并通知渲染进程
     */
    private setStatus(status: UpdateStatus, error?: string): void {
        this.currentStatus = status;
        this.lastError = error || null;

        if (status !== "downloading") {
            this.downloadProgress = 0;
        }

        this.notifyRenderer("status-changed", this.getStatus());
    }

    /**
     * 向渲染进程发送通知
     */
    private notifyRenderer(event: string, data?: any): void {
        this.mainWindow?.webContents.send(`picasa:update-${event}`, data);
    }

    /**
     * 处理错误并分类
     */
    private handleError(error: any): string {
        let errorString: string;

        if (error?.message && typeof error.message === "string") {
            errorString = error.message;
        } else if (typeof error === "string") {
            errorString = error;
        } else if (error?.code) {
            errorString = `Error code: ${error.code}`;
        } else if (error?.name) {
            errorString = `Error: ${error.name}`;
        } else {
            errorString = "未知错误";
        }

        // 错误分类（遵循RFC 0019设计模式）
        if (
            errorString.includes("net::") ||
            errorString.includes("ENOTFOUND") ||
            errorString.includes("ECONNREFUSED") ||
            errorString.includes("ETIMEDOUT")
        ) {
            return "网络连接错误，请检查网络连接";
        }

        if (
            errorString.includes("certificate") ||
            errorString.includes("cert") ||
            errorString.includes("CERT_HAS_EXPIRED") ||
            errorString.includes("CERT_UNTRUSTED")
        ) {
            return "证书验证错误，请检查系统时间设置";
        }

        if (errorString.includes("ENOSPC") || errorString.includes("space")) {
            return "磁盘空间不足，请清理磁盘空间";
        }

        if (
            errorString.includes("EACCES") ||
            errorString.includes("EPERM") ||
            errorString.includes("permission")
        ) {
            return "权限不足，请以管理员身份运行";
        }

        if (
            errorString.includes("integrity") ||
            errorString.includes("checksum") ||
            errorString.includes("ERR_UPDATER_SHA2_VALIDATION_FAILED")
        ) {
            return "文件完整性验证失败，请重试";
        }

        if (errorString.includes("ERR_UPDATER_INVALID_RELEASE_FEED")) {
            return "服务器返回数据格式错误";
        }

        if (
            errorString.includes("ERR_UPDATER_ZIP_FILE_NOT_FOUND") ||
            errorString.includes("ERR_UPDATER_CANNOT_FIND_CHANNEL_FILE")
        ) {
            return "更新文件不存在或已被删除";
        }

        // 处理临时文件相关错误
        if (
            errorString.includes("ENOENT") ||
            errorString.includes("no such file or directory") ||
            errorString.includes("temp-")
        ) {
            return "临时文件访问错误，请重试更新";
        }

        return `更新失败: ${errorString}`;
    }

    /**
     * 注册IPC处理器
     */
    private registerIpcHandlers(): void {
        // 检查更新
        this.ipc.handle("picasa:check-for-updates", async () => {
            return this.checkForUpdates();
        });

        // 下载更新
        this.ipc.handle("picasa:download-update", async () => {
            return this.downloadUpdate();
        });

        // 安装更新
        this.ipc.handle("picasa:install-update", async () => {
            return this.quitAndInstall();
        });

        // 获取更新状态
        this.ipc.handle("picasa:get-update-status", async () => {
            return this.getStatus();
        });

        // 获取应用版本
        this.ipc.handle("picasa:get-app-version", async () => {
            return this.getAppVersion();
        });

        // 更新配置
        this.ipc.handle(
            "picasa:update-auto-update-config",
            async (_, config: Partial<AutoUpdateConfig>) => {
                this.updateConfig(config);
                return true;
            },
        );
    }
}
