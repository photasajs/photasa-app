/**
 * 服务注册中心
 */

import { EventEmitter } from "events";
import { BrowserWindow, IpcMain, App } from "electron";
import { loggers } from "@common/logger";
import {
    IService,
    ServiceMetadata,
    ServiceFactory,
    ServiceInitOptions,
    ServiceEvent,
    ServiceEventData,
    ServiceStatus,
    ServicePriority,
} from "./service-types";

const logger = loggers.main;

export class ServiceRegistry extends EventEmitter {
    private static instance: ServiceRegistry;
    private services = new Map<string, ServiceMetadata>();
    private factories = new Map<string, ServiceFactory>();
    private instances = new Map<string, IService>();
    private initPromises = new Map<string, Promise<IService>>();
    private serviceStatus = new Map<string, ServiceStatus>();

    private constructor(
        private ipcMain: IpcMain,
        private mainWindow: BrowserWindow,
        private app: App,
    ) {
        super();
    }

    /**
     * 获取单例实例
     */
    static getInstance(ipcMain: IpcMain, mainWindow: BrowserWindow, app: App): ServiceRegistry {
        if (!ServiceRegistry.instance) {
            ServiceRegistry.instance = new ServiceRegistry(ipcMain, mainWindow, app);
        }
        return ServiceRegistry.instance;
    }

    /**
     * 注册服务
     */
    register(metadata: ServiceMetadata, factory: ServiceFactory): void {
        logger.debug(`Registering service: ${metadata.name}`);
        this.services.set(metadata.name, metadata);
        this.factories.set(metadata.name, factory);
        this.serviceStatus.set(metadata.name, {
            running: false,
            restartCount: 0,
        });
    }

    /**
     * 按优先级初始化服务
     */
    async initializeByPriority(): Promise<void> {
        const startTime = Date.now();
        logger.info("Starting service initialization by priority");

        try {
            const grouped = this.groupByPriority();

            // 初始化关键服务（阻塞）
            logger.debug("Initializing critical services...");
            await this.initializeGroup(grouped.critical, {
                blocking: true,
            });

            // 异步初始化重要服务
            logger.debug("Initializing important services...");
            this.initializeGroup(grouped.important, {
                blocking: false,
            });

            // 延迟初始化后台服务
            logger.debug("Scheduling background services...");
            setTimeout(() => {
                this.initializeGroup(grouped.background, {
                    blocking: false,
                    staggered: true,
                    staggerDelay: 500,
                });
            }, 3000);

            const elapsed = Date.now() - startTime;
            logger.info(`Service initialization scheduled in ${elapsed}ms`);
        } catch (error) {
            logger.error("Service initialization failed:", error);
            throw error;
        }
    }

    /**
     * 按优先级分组服务
     */
    private groupByPriority(): Record<string, ServiceMetadata[]> {
        const grouped: Record<string, ServiceMetadata[]> = {
            critical: [],
            important: [],
            background: [],
        };

        for (const [_, metadata] of this.services) {
            switch (metadata.priority) {
                case ServicePriority.Critical:
                    grouped.critical.push(metadata);
                    break;
                case ServicePriority.Important:
                    grouped.important.push(metadata);
                    break;
                case ServicePriority.Background:
                    grouped.background.push(metadata);
                    break;
            }
        }

        // 按依赖关系排序
        for (const group of Object.values(grouped)) {
            this.sortByDependencies(group);
        }

        return grouped;
    }

    /**
     * 根据依赖关系排序服务
     */
    private sortByDependencies(services: ServiceMetadata[]): void {
        const sorted: ServiceMetadata[] = [];
        const visiting = new Set<string>();
        const visited = new Set<string>();

        const visit = (metadata: ServiceMetadata) => {
            if (visited.has(metadata.name)) return;
            if (visiting.has(metadata.name)) {
                throw new Error(`Circular dependency detected: ${metadata.name}`);
            }

            visiting.add(metadata.name);

            if (metadata.dependencies) {
                for (const dep of metadata.dependencies) {
                    const depService = services.find((s) => s.name === dep);
                    if (depService) {
                        visit(depService);
                    }
                }
            }

            visiting.delete(metadata.name);
            visited.add(metadata.name);
            sorted.push(metadata);
        };

        for (const service of services) {
            visit(service);
        }

        services.length = 0;
        services.push(...sorted);
    }

    /**
     * 初始化一组服务
     */
    private async initializeGroup(
        services: ServiceMetadata[],
        options: ServiceInitOptions,
    ): Promise<void> {
        if (options.staggered) {
            // 错开初始化时间，避免资源竞争
            for (const service of services) {
                await this.initializeService(service);
                if (options.staggerDelay) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, service.startupDelay || options.staggerDelay),
                    );
                }
            }
        } else if (options.blocking) {
            // 并行初始化，但等待所有完成
            await Promise.all(services.map((s) => this.initializeService(s)));
        } else {
            // 非阻塞异步初始化
            services.forEach((s) => this.initializeService(s));
        }
    }

    /**
     * 初始化单个服务
     */
    private async initializeService(metadata: ServiceMetadata): Promise<IService> {
        const { name } = metadata;

        // 检查是否已经在初始化中
        const existingPromise = this.initPromises.get(name);
        if (existingPromise) {
            return existingPromise;
        }

        // 检查是否已经初始化
        const existingInstance = this.instances.get(name);
        if (existingInstance) {
            return existingInstance;
        }

        const initPromise = this.doInitializeService(metadata);
        this.initPromises.set(name, initPromise);

        try {
            const instance = await initPromise;
            this.instances.set(name, instance);
            this.initPromises.delete(name);
            return instance;
        } catch (error) {
            this.initPromises.delete(name);
            throw error;
        }
    }

    /**
     * 执行服务初始化
     */
    private async doInitializeService(metadata: ServiceMetadata): Promise<IService> {
        const { name, dependencies, startupDelay } = metadata;

        logger.debug(`Initializing service: ${name}`);

        try {
            // 等待启动延迟
            if (startupDelay && startupDelay > 0) {
                await new Promise((resolve) => setTimeout(resolve, startupDelay));
            }

            // 解析依赖
            const deps = await this.resolveDependencies(dependencies);

            // 创建服务实例
            const factory = this.factories.get(name);
            if (!factory) {
                throw new Error(`Service factory not found: ${name}`);
            }

            const instance = factory(this.ipcMain, this.mainWindow, this.app, deps);

            // 初始化服务
            await instance.initialize();

            // 更新状态
            this.updateServiceStatus(name, {
                running: true,
                healthy: true,
                startTime: new Date(),
            });

            // 发送事件
            this.emitServiceEvent({
                serviceName: name,
                event: ServiceEvent.STARTED,
                timestamp: new Date(),
            });

            logger.info(`Service initialized: ${name}`);
            return instance;
        } catch (error) {
            logger.error(`Failed to initialize service ${name}:`, error);

            // 更新状态
            this.updateServiceStatus(name, {
                running: false,
                error: error instanceof Error ? error.message : String(error),
            });

            // 发送事件
            this.emitServiceEvent({
                serviceName: name,
                event: ServiceEvent.START_FAILED,
                timestamp: new Date(),
                error: error instanceof Error ? error : new Error(String(error)),
            });

            // 如果设置了重试，则进行重试
            if (metadata.retryOnFailure) {
                return this.retryServiceInitialization(metadata);
            }

            throw error;
        }
    }

    /**
     * 解析服务依赖
     */
    private async resolveDependencies(dependencies?: string[]): Promise<Map<string, IService>> {
        const deps = new Map<string, IService>();

        if (!dependencies || dependencies.length === 0) {
            return deps;
        }

        for (const depName of dependencies) {
            const depMetadata = this.services.get(depName);
            if (!depMetadata) {
                throw new Error(`Dependency not found: ${depName}`);
            }

            const instance = await this.initializeService(depMetadata);
            deps.set(depName, instance);
        }

        return deps;
    }

    /**
     * 重试服务初始化
     */
    private async retryServiceInitialization(metadata: ServiceMetadata): Promise<IService> {
        const maxRetries = metadata.maxRetries || 3;
        const status = this.serviceStatus.get(metadata.name);
        const restartCount = status?.restartCount || 0;

        if (restartCount >= maxRetries) {
            throw new Error(`Service ${metadata.name} failed after ${maxRetries} retries`);
        }

        logger.warn(
            `Retrying service ${metadata.name} initialization (attempt ${restartCount + 1}/${maxRetries})`,
        );

        // 更新重启计数
        this.updateServiceStatus(metadata.name, {
            restartCount: restartCount + 1,
        });

        // 指数退避
        const delay = Math.min(1000 * Math.pow(2, restartCount), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));

        return this.doInitializeService(metadata);
    }

    /**
     * 更新服务状态
     */
    private updateServiceStatus(name: string, status: Partial<ServiceStatus>): void {
        const current = this.serviceStatus.get(name) || {
            running: false,
            restartCount: 0,
        };
        this.serviceStatus.set(name, { ...current, ...status });
    }

    /**
     * 发送服务事件
     */
    private emitServiceEvent(data: ServiceEventData): void {
        this.emit(data.event, data);
        this.emit("service:event", data);
    }

    /**
     * 获取服务实例
     */
    getInstance(name: string): IService | undefined {
        return this.instances.get(name);
    }

    /**
     * 获取服务元数据
     */
    getMetadata(name: string): ServiceMetadata | undefined {
        return this.services.get(name);
    }

    /**
     * 获取服务状态
     */
    getStatus(name: string): ServiceStatus | undefined {
        return this.serviceStatus.get(name);
    }

    /**
     * 获取所有服务状态
     */
    getAllStatus(): Map<string, ServiceStatus> {
        return new Map(this.serviceStatus);
    }

    /**
     * 关闭所有服务
     */
    async shutdownAll(): Promise<void> {
        logger.info("Shutting down all services");

        const shutdownPromises: Promise<void>[] = [];

        // 按优先级反向关闭（后台服务先关闭）
        const grouped = this.groupByPriority();
        const orderedGroups = [grouped.background, grouped.important, grouped.critical];

        for (const group of orderedGroups) {
            for (const metadata of group) {
                const instance = this.instances.get(metadata.name);
                if (instance?.shutdown) {
                    shutdownPromises.push(
                        instance.shutdown().catch((error) => {
                            logger.error(`Error shutting down ${metadata.name}:`, error);
                        }),
                    );
                }
            }
        }

        await Promise.all(shutdownPromises);

        // 清理状态
        this.instances.clear();
        this.initPromises.clear();
        this.serviceStatus.clear();

        logger.info("All services shut down");
    }

    /**
     * 重启服务
     */
    async restartService(name: string): Promise<void> {
        const instance = this.instances.get(name);
        const metadata = this.services.get(name);

        if (!metadata) {
            throw new Error(`Service not found: ${name}`);
        }

        // 关闭现有实例
        if (instance?.shutdown) {
            await instance.shutdown();
        }

        // 清理状态
        this.instances.delete(name);
        this.initPromises.delete(name);

        // 重新初始化
        await this.initializeService(metadata);
    }

    /**
     * 检查服务是否已初始化
     */
    isInitialized(name: string): boolean {
        return this.instances.has(name);
    }

    /**
     * 获取服务状态
     */
    getServiceStatus(name: string): ServiceStatus | undefined {
        return this.serviceStatus.get(name);
    }

    /**
     * 获取所有服务状态
     */
    getAllServiceStatus(): Map<string, ServiceStatus> {
        return new Map(this.serviceStatus);
    }

    /**
     * 启动健康监控
     */
    startHealthMonitoring(): void {
        // 健康监控功能的实现将在后续版本中添加
        logger.info("Health monitoring feature will be implemented in future versions");
    }

    /**
     * 停止健康监控
     */
    stopHealthMonitoring(): void {
        // 健康监控功能的实现将在后续版本中添加
        logger.info("Health monitoring feature will be implemented in future versions");
    }
}
