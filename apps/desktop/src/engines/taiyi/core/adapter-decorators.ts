/**
 * 承宣引擎适配器装饰器
 * 用于注册引擎适配器，替代传统的@Service装饰器
 */

import { AdapterRegistry } from "./adapter-registry";

/**
 * 适配器配置接口
 */
export interface AdapterConfig {
    /** 适配器名称 */
    name: string;
    /** 适配器显示名称 */
    displayName: string;
    /** 适配器优先级 */
    priority: AdapterPriority;
    /** 适配器描述 */
    description: string;
    /** 依赖的其他适配器 */
    dependencies?: string[];
    /** 失败时是否重试 */
    retryOnFailure?: boolean;
    /** 最大重试次数 */
    maxRetries?: number;
    /** 引擎类型 */
    engineType: string;
}

/**
 * 适配器优先级枚举
 */
export enum AdapterPriority {
    Critical = 0,
    High = 1,
    Normal = 2,
    Low = 3,
}

/**
 * 适配器接口
 */
export interface IAdapter {
    readonly name: string;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
}

/**
 * @Adapter 装饰器
 * 用于标记和注册引擎适配器
 */
export function Adapter(config: AdapterConfig) {
    return function <T extends new (...args: any[]) => IAdapter>(constructor: T) {
        // 注册适配器到承宣注册中心
        AdapterRegistry.registerAdapter(config, constructor);
        return constructor;
    };
}

/**
 * 适配器工厂函数类型
 */
export type AdapterFactory = new (...args: any[]) => IAdapter;
