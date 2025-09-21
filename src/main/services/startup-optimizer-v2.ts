/**
 * 基于 ServiceRegistry 的新版启动优化器
 * 使用服务配置和注册中心来管理服务初始化
 */

import { App, BrowserWindow, IpcMain } from "electron";
import { loggers } from "@common/logger";
import { ServiceRegistry } from "./core/service-registry";
import { serviceConfig } from "./config/service-config";
import { serviceFactories } from "./factories/service-factories";
import { IService } from "./core/service-types";

const logger = loggers.main;

export class StartupOptimizerV2 {
    private serviceRegistry: ServiceRegistry;

    constructor(
        private mainWindow: BrowserWindow,
        private app: App,
        private ipcMain: IpcMain,
    ) {
        this.serviceRegistry = ServiceRegistry.getInstance(this.ipcMain, this.mainWindow, this.app);
        this.registerAllServices();
    }

    /**
     * 注册所有服务到注册中心
     */
    private registerAllServices(): void {
        logger.debug("Registering all services to ServiceRegistry");

        for (const config of serviceConfig) {
            const factory = serviceFactories[config.name];
            if (!factory) {
                logger.warn(`No factory found for service: ${config.name}`);
                continue;
            }

            // 注册服务
            this.serviceRegistry.register(config, factory);
            logger.debug(`Registered service: ${config.name} (${config.priority})`);
        }

        logger.info(`Registered ${serviceConfig.length} services`);
    }

    /**
     * 按优先级初始化服务
     */
    async initializeServices(): Promise<void> {
        const startTime = Date.now();
        logger.info("Starting service initialization with ServiceRegistry");

        try {
            // 使用 ServiceRegistry 的按优先级初始化
            await this.serviceRegistry.initializeByPriority();

            const initTime = Date.now() - startTime;
            logger.info(`All services initialized successfully in ${initTime}ms`);
        } catch (error) {
            logger.error("Service initialization failed:", error);
            throw error;
        }
    }

    /**
     * 获取指定服务实例
     */
    async getService<T extends IService>(name: string): Promise<T | undefined> {
        try {
            return (await this.serviceRegistry.getInstance(name)) as T;
        } catch (error) {
            logger.error(`Failed to get service ${name}:`, error);
            return undefined;
        }
    }

    /**
     * 检查服务是否已初始化
     */
    isServiceInitialized(name: string): boolean {
        return this.serviceRegistry.isInitialized(name);
    }

    /**
     * 获取服务状态
     */
    getServiceStatus(name: string) {
        return this.serviceRegistry.getServiceStatus(name);
    }

    /**
     * 获取所有服务状态
     */
    getAllServiceStatus() {
        return this.serviceRegistry.getAllServiceStatus();
    }

    /**
     * 重启服务
     */
    async restartService(name: string): Promise<void> {
        try {
            await this.serviceRegistry.restartService(name);
            logger.info(`Service ${name} restarted successfully`);
        } catch (error) {
            logger.error(`Failed to restart service ${name}:`, error);
            throw error;
        }
    }

    /**
     * 关闭所有服务
     */
    async shutdownAllServices(): Promise<void> {
        try {
            await this.serviceRegistry.shutdownAll();
            logger.info("All services shut down successfully");
        } catch (error) {
            logger.error("Failed to shutdown services:", error);
            throw error;
        }
    }

    /**
     * 获取服务统计信息
     */
    getServiceStatistics() {
        const allStatus = this.getAllServiceStatus();
        const stats = {
            total: allStatus.size,
            running: 0,
            failed: 0,
            healthy: 0,
            unhealthy: 0,
        };

        for (const status of allStatus.values()) {
            if (status.running) {
                stats.running++;
            } else {
                stats.failed++;
            }

            if (status.healthy === true) {
                stats.healthy++;
            } else if (status.healthy === false) {
                stats.unhealthy++;
            }
        }

        return stats;
    }

    /**
     * 启用健康监控
     */
    startHealthMonitoring(): void {
        this.serviceRegistry.startHealthMonitoring();
        logger.info("Service health monitoring started");
    }

    /**
     * 停止健康监控
     */
    stopHealthMonitoring(): void {
        this.serviceRegistry.stopHealthMonitoring();
        logger.info("Service health monitoring stopped");
    }
}
