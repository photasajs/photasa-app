/**
 * 应用启动优化器
 * 通过延迟初始化和并行加载来提升启动性能
 */

import { App, BrowserWindow, IpcMain } from "electron";
import { loggers } from "@common/logger";
import ThumbnailService from "./thumbnail/thumbnail-service";
import ConfigService from "./config/config-service";
import ScanService from "./scan/scan-service";
import WatchService from "./watch/watch-service";
import WindowService from "./window/window-service";
// ✅ RFC 0058: MenuService 已移除，菜单管理迁移到 TaibaijinxingAdapter
// ✅ RFC 0058: ShellService 已合并到 TaibaijinxingAdapter
import ImportService from "./import/import-service";
import LogViewerService from "./log-viewer/log-viewer-service";
import UpdateService from "./update/update-service";

const logger = loggers.main;

export interface ServicePriority {
    critical: Array<() => Promise<any> | any>;
    important: Array<() => Promise<any> | any>;
    background: Array<() => Promise<any> | any>;
}

export class StartupOptimizer {
    private services: Map<string, any> = new Map();
    private initializationPromises: Map<string, Promise<any>> = new Map();

    constructor(
        private mainWindow: BrowserWindow,
        private app: App,
        private ipcMain: IpcMain,
    ) {}

    /**
     * 按优先级初始化服务
     */
    async initializeServices(): Promise<void> {
        const startTime = Date.now();
        logger.info("Starting service initialization with optimization");

        // 定义服务初始化优先级
        const servicePriorities = this.defineServicePriorities();

        try {
            // 1. 立即初始化关键服务（阻塞启动）
            logger.debug("Initializing critical services...");
            await this.initializeCriticalServices(servicePriorities.critical);

            // 2. 并行初始化重要服务（非阻塞）
            logger.debug("Starting important services in parallel...");
            this.initializeImportantServicesAsync(servicePriorities.important);

            // 3. 延迟初始化后台服务
            logger.debug("Scheduling background services...");
            this.scheduleBackgroundServices(servicePriorities.background);

            const initTime = Date.now() - startTime;
            logger.info(`Critical services initialized in ${initTime}ms`);
        } catch (error) {
            logger.error("Service initialization failed:", error);
            throw error;
        }
    }

    /**
     * 定义服务初始化优先级
     */
    private defineServicePriorities(): ServicePriority {
        return {
            // 关键服务：必须在主窗口显示前完成
            critical: [
                () => this.createLogViewerService(),
                () => this.createConfigService(),
                () => this.createWindowService(),
            ],

            // 重要服务：可以在主窗口显示后立即初始化
            important: [
                // ✅ RFC 0058: MenuService 已移除，菜单管理迁移到 TaibaijinxingAdapter
                // ✅ RFC 0058: ShellService 已合并到 TaibaijinxingAdapter
                () => this.createUpdateService(),
            ],

            // 后台服务：可以延迟到用户交互后初始化
            background: [
                () => this.createThumbnailService(),
                () => this.createScanService(),
                () => this.createWatchService(),
                () => this.createImportService(),
            ],
        };
    }

    /**
     * 初始化关键服务（同步阻塞）
     */
    private async initializeCriticalServices(
        criticalServices: Array<() => Promise<any> | any>,
    ): Promise<void> {
        for (const serviceInit of criticalServices) {
            try {
                await serviceInit();
            } catch (error) {
                logger.error("Critical service initialization failed:", error);
                throw error;
            }
        }
    }

    /**
     * 异步初始化重要服务（非阻塞）
     */
    private initializeImportantServicesAsync(
        importantServices: Array<() => Promise<any> | any>,
    ): void {
        // 使用 setImmediate 确保在下一个事件循环中执行
        setImmediate(async () => {
            const promises = importantServices.map(async (serviceInit) => {
                try {
                    return await serviceInit();
                } catch (error) {
                    logger.error("Important service initialization failed:", error);
                    return null;
                }
            });

            try {
                await Promise.all(promises);
                logger.info("Important services initialized");
            } catch (error) {
                logger.error("Some important services failed to initialize:", error);
            }
        });
    }

    /**
     * 延迟初始化后台服务
     */
    private scheduleBackgroundServices(backgroundServices: Array<() => Promise<any> | any>): void {
        // 延迟2秒后开始初始化后台服务
        setTimeout(async () => {
            logger.debug("Starting background services initialization...");

            for (const serviceInit of backgroundServices) {
                try {
                    // 每个服务之间间隔100ms，避免资源争抢
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    await serviceInit();
                } catch (error) {
                    logger.error("Background service initialization failed:", error);
                    // 后台服务失败不影响应用运行
                }
            }

            logger.info("All background services initialized");
        }, 2000);
    }

    // 服务创建方法
    private async createLogViewerService(): Promise<LogViewerService> {
        const service = new LogViewerService(this.ipcMain, this.mainWindow);
        this.services.set("logViewer", service);
        return service;
    }

    private async createConfigService(): Promise<ConfigService> {
        const service = new ConfigService(this.ipcMain, this.mainWindow);
        this.services.set("config", service);
        return service;
    }

    private async createWindowService(): Promise<WindowService> {
        const service = new WindowService(this.ipcMain, this.mainWindow, this.app);
        this.services.set("window", service);
        return service;
    }

    // ✅ RFC 0058: MenuService 已移除，菜单管理迁移到 TaibaijinxingAdapter
    // ✅ RFC 0058: ShellService 已合并到 TaibaijinxingAdapter

    private async createUpdateService(): Promise<UpdateService> {
        const service = new UpdateService(this.ipcMain, this.mainWindow);
        this.services.set("update", service);
        return service;
    }

    private async createThumbnailService(): Promise<ThumbnailService> {
        const logViewerService = this.services.get("logViewer");
        const service = new ThumbnailService(
            this.ipcMain,
            this.mainWindow,
            this.app,
            logViewerService,
        );
        this.services.set("thumbnail", service);
        return service;
    }

    private async createScanService(): Promise<ScanService> {
        const logViewerService = this.services.get("logViewer");
        const service = new ScanService(this.ipcMain, this.mainWindow, this.app, logViewerService);
        this.services.set("scan", service);
        return service;
    }

    private async createWatchService(): Promise<WatchService> {
        const service = new WatchService(this.ipcMain, this.mainWindow);
        this.services.set("watch", service);
        return service;
    }

    private async createImportService(): Promise<ImportService> {
        const service = new ImportService(this.ipcMain, this.mainWindow);
        this.services.set("import", service);
        return service;
    }

    /**
     * 获取已初始化的服务
     */
    getService<T>(name: string): T | undefined {
        return this.services.get(name);
    }

    /**
     * 等待特定服务初始化完成
     */
    async waitForService(name: string, timeout = 5000): Promise<any> {
        const existing = this.services.get(name);
        if (existing) {
            return existing;
        }

        const promise = this.initializationPromises.get(name);
        if (promise) {
            return Promise.race([
                promise,
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error(`Service ${name} initialization timeout`)),
                        timeout,
                    ),
                ),
            ]);
        }

        throw new Error(`Service ${name} not found`);
    }

    /**
     * 获取所有服务的状态
     */
    getServiceStatus(): Record<string, boolean> {
        const status: Record<string, boolean> = {};
        for (const [name] of this.services) {
            status[name] = true;
        }
        return status;
    }
}
