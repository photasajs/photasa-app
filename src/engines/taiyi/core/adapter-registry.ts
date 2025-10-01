/**
 * 承宣适配器注册中心
 * 管理所有引擎适配器的注册、实例化和生命周期
 */

import { AdapterConfig, AdapterFactory, IAdapter } from "./adapter-decorators";

/**
 * 适配器注册信息
 */
interface AdapterRegistration {
    config: AdapterConfig;
    factory: AdapterFactory;
    instance?: IAdapter;
    status: "registered" | "initializing" | "ready" | "error" | "shutdown";
    lastError?: Error;
}

/**
 * 承宣适配器注册中心
 */
export class AdapterRegistry {
    private static adapters = new Map<string, AdapterRegistration>();
    // private static _initializationOrder: string[] = [];

    /**
     * 注册适配器
     */
    static registerAdapter(config: AdapterConfig, factory: AdapterFactory): void {
        if (this.adapters.has(config.name)) {
            throw new Error(`Adapter '${config.name}' is already registered`);
        }

        this.adapters.set(config.name, {
            config,
            factory,
            status: "registered",
        });

        console.log(`[AdapterRegistry] Registered adapter: ${config.name} (${config.engineType})`);
    }

    /**
     * 获取所有注册的适配器
     */
    static getRegisteredAdapters(): Map<string, AdapterRegistration> {
        return new Map(this.adapters);
    }

    /**
     * 获取特定适配器
     */
    static getAdapter(name: string): AdapterRegistration | undefined {
        return this.adapters.get(name);
    }

    /**
     * 创建适配器实例
     */
    static async createAdapter(name: string, ...args: any[]): Promise<IAdapter> {
        const registration = this.adapters.get(name);
        if (!registration) {
            throw new Error(`Adapter '${name}' not found`);
        }

        if (registration.instance) {
            return registration.instance;
        }

        try {
            registration.status = "initializing";
            const instance = new registration.factory(...args);
            await instance.initialize();

            registration.instance = instance;
            registration.status = "ready";

            console.log(`[AdapterRegistry] Initialized adapter: ${name}`);
            return instance;
        } catch (error) {
            registration.status = "error";
            registration.lastError = error as Error;
            console.error(`[AdapterRegistry] Failed to initialize adapter ${name}:`, error);
            throw error;
        }
    }

    /**
     * 获取适配器实例
     */
    static getAdapterInstance(name: string): IAdapter | undefined {
        const registration = this.adapters.get(name);
        return registration?.instance;
    }

    /**
     * 初始化所有适配器
     */
    static async initializeAll(...args: any[]): Promise<void> {
        // 按优先级排序
        const sortedAdapters = Array.from(this.adapters.entries()).sort(
            ([, a], [, b]) => a.config.priority - b.config.priority,
        );

        // 处理依赖关系并初始化
        const initialized = new Set<string>();

        for (const [name] of sortedAdapters) {
            await this.initializeWithDependencies(name, initialized, args);
        }

        console.log(`[AdapterRegistry] Initialized ${initialized.size} adapters`);
    }

    /**
     * 递归初始化适配器及其依赖
     */
    private static async initializeWithDependencies(
        name: string,
        initialized: Set<string>,
        args: any[],
    ): Promise<void> {
        if (initialized.has(name)) {
            return;
        }

        const registration = this.adapters.get(name);
        if (!registration) {
            throw new Error(`Adapter '${name}' not found`);
        }

        // 先初始化依赖
        if (registration.config.dependencies) {
            for (const dependency of registration.config.dependencies) {
                await this.initializeWithDependencies(dependency, initialized, args);
            }
        }

        // 初始化当前适配器
        await this.createAdapter(name, ...args);
        initialized.add(name);
    }

    /**
     * 关闭所有适配器
     */
    static async shutdownAll(): Promise<void> {
        const instances = Array.from(this.adapters.values())
            .filter((reg) => reg.instance && reg.status === "ready")
            .reverse(); // 反向关闭

        for (const registration of instances) {
            try {
                if (registration.instance) {
                    await registration.instance.shutdown();
                    registration.status = "shutdown";
                    console.log(`[AdapterRegistry] Shutdown adapter: ${registration.config.name}`);
                }
            } catch (error) {
                console.error(
                    `[AdapterRegistry] Error shutting down adapter ${registration.config.name}:`,
                    error,
                );
            }
        }
    }

    /**
     * 清除所有注册
     */
    static clear(): void {
        this.adapters.clear();
        // this._initializationOrder = [];
    }
}
