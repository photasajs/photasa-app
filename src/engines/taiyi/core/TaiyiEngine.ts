/**
 * 太乙引擎主类
 * 作为引擎服务注册中心，管理所有专业引擎的生命周期和调度
 */

import { EventEmitter } from "events";
import { AdapterRegistry } from "./adapter-registry";
import { loggers } from "@common/logger";

const logger = loggers.taiyi;

/**
 * 太乙引擎配置
 */
export interface TaiyiEngineConfig {
    /** 适配器初始化参数 */
    adapterArgs?: any[];
    /** 是否启用健康检查 */
    enableHealthCheck?: boolean;
    /** 健康检查间隔（毫秒） */
    healthCheckInterval?: number;
}

/**
 * 引擎调用结果
 */
export interface EngineCallResult<T = any> {
    success: boolean;
    result?: T;
    error?: Error;
    timestamp: number;
    engineName: string;
}

/**
 * 太乙引擎主类
 */
export class TaiyiEngine extends EventEmitter {
    private config: TaiyiEngineConfig;
    private isInitialized = false;
    private healthCheckTimer?: NodeJS.Timeout;

    constructor(config: TaiyiEngineConfig = {}) {
        super();
        this.config = {
            adapterArgs: [],
            enableHealthCheck: false,
            healthCheckInterval: 30000,
            ...config,
        };
    }

    /**
     * 初始化太乙引擎
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            logger.info("🌌 初始化太乙引擎");
            // 初始化所有注册的适配器
            await AdapterRegistry.initializeAll(...(this.config.adapterArgs || []));

            // 启动健康检查
            if (this.config.enableHealthCheck) {
                this.startHealthCheck();
            }

            this.isInitialized = true;
            logger.info("🌌 太乙引擎初始化完成");
            this.emit("initialized");
        } catch (error) {
            logger.error("🌌 初始化太乙引擎失败", error);
            throw error;
        }
    }

    /**
     * 关闭太乙引擎
     */
    async shutdown(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        try {
            logger.info("🌌 关闭太乙引擎");

            // 停止健康检查
            if (this.healthCheckTimer) {
                clearInterval(this.healthCheckTimer);
                this.healthCheckTimer = undefined;
            }

            // 关闭所有适配器
            await AdapterRegistry.shutdownAll();

            this.isInitialized = false;
            logger.info("🌌 太乙引擎关闭完成");
            this.emit("shutdown");
        } catch (error) {
            logger.error("🌌 关闭太乙引擎失败", error);
            throw error;
        }
    }

    /**
     * 调用指定引擎的方法
     */
    async callEngine<T = any>(
        engineName: string,
        methodName: string,
        ...args: any[]
    ): Promise<EngineCallResult<T>> {
        const timestamp = Date.now();

        try {
            const adapter = AdapterRegistry.getAdapterInstance(engineName);
            if (!adapter) {
                throw new Error(`Engine '${engineName}' not found or not initialized`);
            }

            // 调用适配器方法
            const method = (adapter as any)[methodName];
            if (typeof method !== "function") {
                throw new Error(`Method '${methodName}' not found in engine '${engineName}'`);
            }

            const result = await method.apply(adapter, args);

            return {
                success: true,
                result,
                timestamp,
                engineName,
            };
        } catch (error) {
            logger.error(`🌌 调用引擎失败: ${engineName}.${methodName}`, error);

            return {
                success: false,
                error: error as Error,
                timestamp,
                engineName,
            };
        }
    }

    /**
     * 获取引擎状态
     */
    getEngineStatus(engineName: string): string | undefined {
        const registration = AdapterRegistry.getAdapter(engineName);
        return registration?.status;
    }

    /**
     * 获取所有引擎状态
     */
    getAllEngineStatus(): Record<string, string> {
        const status: Record<string, string> = {};
        const adapters = AdapterRegistry.getRegisteredAdapters();

        for (const [name, registration] of adapters) {
            status[name] = registration.status;
        }

        return status;
    }

    /**
     * 检查引擎是否可用
     */
    isEngineReady(engineName: string): boolean {
        const status = this.getEngineStatus(engineName);
        return status === "ready";
    }

    /**
     * 获取可用的引擎列表
     */
    getAvailableEngines(): string[] {
        const adapters = AdapterRegistry.getRegisteredAdapters();
        return Array.from(adapters.entries())
            .filter(([, registration]) => registration.status === "ready")
            .map(([name]) => name);
    }

    /**
     * 启动健康检查
     */
    private startHealthCheck(): void {
        this.healthCheckTimer = setInterval(() => {
            const status = this.getAllEngineStatus();
            this.emit("healthCheck", status);

            // 检查是否有失败的引擎
            const failedEngines = Object.entries(status)
                .filter(([, status]) => status === "error")
                .map(([name]) => name);

            if (failedEngines.length > 0) {
                this.emit("engineFailure", failedEngines);
            }
        }, this.config.healthCheckInterval);
    }
}
