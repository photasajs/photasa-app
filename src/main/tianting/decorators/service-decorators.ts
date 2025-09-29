/**
 * @Service 装饰器实现
 * 提供声明式服务配置和自动注册功能
 */

import { ServiceMetadata, ServicePriority, IService } from "../core/service-types";

/**
 * 服务装饰器配置选项
 */
export interface ServiceDecoratorOptions {
    /** 服务名称（唯一标识符） */
    name: string;
    /** 服务显示名称 */
    displayName?: string;
    /** 服务优先级 */
    priority?: ServicePriority;
    /** 依赖的其他服务名称 */
    dependencies?: string[];
    /** 是否懒加载 */
    lazyLoad?: boolean;
    /** 启动延迟（毫秒） */
    startupDelay?: number;
    /** 失败时是否重试 */
    retryOnFailure?: boolean;
    /** 最大重试次数 */
    maxRetries?: number;
    /** 服务描述 */
    description?: string;
    /** 初始化方法名 */
    initMethod?: string;
    /** 关闭方法名 */
    shutdownMethod?: string;
}

/**
 * 服务构造函数类型
 */
export type ServiceConstructor = new (...args: any[]) => IService;

/**
 * 装饰器服务元数据
 */
export interface DecoratedServiceMetadata extends ServiceMetadata {
    /** 服务构造函数 */
    constructor: ServiceConstructor;
    /** 装饰器配置选项 */
    decoratorOptions: ServiceDecoratorOptions;
}

/**
 * 全局装饰器服务注册表
 */
class DecoratedServiceRegistry {
    private static instance: DecoratedServiceRegistry;
    private services = new Map<string, DecoratedServiceMetadata>();

    static getInstance(): DecoratedServiceRegistry {
        if (!DecoratedServiceRegistry.instance) {
            DecoratedServiceRegistry.instance = new DecoratedServiceRegistry();
        }
        return DecoratedServiceRegistry.instance;
    }

    /**
     * 注册装饰器服务
     */
    register(constructor: ServiceConstructor, options: ServiceDecoratorOptions): void {
        const metadata: DecoratedServiceMetadata = {
            name: options.name,
            displayName: options.displayName || options.name,
            priority: options.priority || ServicePriority.Important,
            dependencies: options.dependencies || [],
            lazyLoad: options.lazyLoad ?? false,
            startupDelay: options.startupDelay,
            retryOnFailure: options.retryOnFailure ?? true,
            maxRetries: options.maxRetries ?? 3,
            description: options.description || `${options.displayName || options.name} 服务`,
            constructor,
            decoratorOptions: options,
        };

        this.services.set(options.name, metadata);
    }

    /**
     * 获取所有注册的服务
     */
    getAllServices(): DecoratedServiceMetadata[] {
        return Array.from(this.services.values());
    }

    /**
     * 根据名称获取服务元数据
     */
    getService(name: string): DecoratedServiceMetadata | undefined {
        return this.services.get(name);
    }

    /**
     * 检查服务是否已注册
     */
    hasService(name: string): boolean {
        return this.services.has(name);
    }

    /**
     * 获取所有服务名称
     */
    getServiceNames(): string[] {
        return Array.from(this.services.keys());
    }
}

/**
 * @Service 装饰器
 * 用于自动注册和配置服务
 *
 * @example
 * ```typescript
 * @Service({
 *   name: "config",
 *   displayName: "配置服务",
 *   priority: ServicePriority.Critical
 * })
 * class ConfigService implements IService {
 *   async initialize() { ... }
 *   async shutdown() { ... }
 * }
 * ```
 */
export function Service(options: ServiceDecoratorOptions) {
    return function <T extends ServiceConstructor>(constructor: T): T {
        // 验证配置选项
        if (!options.name) {
            throw new Error("Service name is required");
        }

        // 检查服务名称是否已被使用
        const registry = DecoratedServiceRegistry.getInstance();
        if (registry.hasService(options.name)) {
            throw new Error(`Service with name "${options.name}" is already registered`);
        }

        // 注册服务到全局注册表
        registry.register(constructor, options);

        // 在构造函数上添加元数据标记
        (constructor as any).__serviceMetadata = options;
        (constructor as any).__isDecoratedService = true;

        return constructor;
    };
}

/**
 * 获取装饰器服务注册表实例
 */
export function getDecoratedServiceRegistry(): DecoratedServiceRegistry {
    return DecoratedServiceRegistry.getInstance();
}

/**
 * 检查类是否是装饰器服务
 */
export function isDecoratedService(constructor: any): boolean {
    return constructor && constructor.__isDecoratedService === true;
}

/**
 * 获取服务的装饰器元数据
 */
export function getServiceMetadata(constructor: any): ServiceDecoratorOptions | undefined {
    return constructor && constructor.__serviceMetadata;
}

/**
 * 清空服务注册表（主要用于测试）
 */
export function clearServiceRegistry(): void {
    DecoratedServiceRegistry.getInstance()["services"].clear();
}
