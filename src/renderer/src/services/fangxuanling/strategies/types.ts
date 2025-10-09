/**
 * 房玄龄策略模式类型定义
 * 消除switch case hell，实现Linus "好品味"原则
 *
 * 设计原理：
 * 1. 策略接口统一：所有操作都遵循相同的策略接口
 * 2. 函数式组合：支持策略组合和链式调用
 * 3. 类型安全：通过TypeScript确保策略类型正确
 * 4. 可扩展性：新增操作只需添加新策略，无需修改核心逻辑
 */

import type { Zouzhe } from "@renderer/interfaces/fang-xuan-ling.interface";

/**
 * 奏折处理策略接口
 * 所有奏折处理器都必须实现此接口
 */
export interface ZouzheStrategy {
    /**
     * 处理奏折的核心方法
     * @param zouzhe 奏折内容
     * @returns 处理结果
     */
    handle(zouzhe: Zouzhe): Promise<void>;

    /**
     * 策略名称，用于调试和日志
     */
    readonly name: string;

    /**
     * 策略描述，用于文档和调试
     */
    readonly description: string;
}

/**
 * 策略注册器类型
 * 管理所有可用的处理策略
 */
export type StrategyRegistry = {
    [key: string]: ZouzheStrategy;
};

/**
 * 路径操作特定的策略参数
 */
export interface PathOperationParams {
    path?: string;
    folder?: string;
    action?: "scan" | "rescan" | "current";
    source?: "user" | "auto";
    size?: number;
    themeId?: string;
    locale?: string;
}

/**
 * 策略执行上下文
 * 提供策略执行时需要的环境信息
 */
export interface StrategyContext {
    /**
     * 偏好管理服务引用
     */
    preferenceService: any;

    /**
     * 日志记录器
     */
    logger: any;

    /**
     * 错误处理器
     */
    errorHandler?: (error: Error, context: string) => void;
}

/**
 * 策略工厂类型
 * 用于创建和管理策略实例
 */
export type StrategyFactory = {
    /**
     * 创建策略实例
     * @param context 策略执行上下文
     * @returns 策略注册器
     */
    createStrategies(context: StrategyContext): StrategyRegistry;
};
