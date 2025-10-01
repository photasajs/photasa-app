/**
 * 内置操作适配器
 * 处理工作流内置操作，如return、setVariable、log等
 */

import { Adapter, AdapterPriority, IAdapter } from "../taiyi/core/adapter-decorators";
import { loggers } from "@common/logger";

const logger = loggers.taiyi;

/**
 * 内置操作参数类型
 */
interface ReturnParams {
    success?: boolean;
    data?: any;
    message?: string;
    error?: string;
}

interface SetVariableParams {
    name: string;
    value: any;
}

interface LogParams {
    level: "info" | "warn" | "error" | "debug";
    message: string;
    metadata?: any;
}

interface DelayParams {
    milliseconds: number;
}

/**
 * 内置操作适配器
 * 使用@Adapter装饰器注册到太乙注册中心
 */
@Adapter({
    name: "builtin",
    displayName: "内置操作适配器",
    priority: AdapterPriority.Critical,
    description: "处理工作流内置操作，如return、setVariable、log、delay等",
    engineType: "builtin",
    dependencies: [], // 内置适配器不依赖其他引擎
    retryOnFailure: false, // 内置操作通常不需要重试
    maxRetries: 0,
})
export class BuiltinAdapter implements IAdapter {
    readonly name = "builtin";

    /**
     * 初始化适配器
     */
    async initialize(): Promise<void> {
        logger.info("🔧 内置操作适配器初始化完成");
    }

    /**
     * 关闭适配器
     */
    async shutdown(): Promise<void> {
        logger.info("🔧 内置操作适配器已关闭");
    }

    /**
     * 返回工作流结果
     * 用于工作流步骤返回最终结果
     */
    async return(params: ReturnParams = {}): Promise<ReturnParams> {
        const result: ReturnParams = {
            success: params.success ?? true,
            data: params.data,
            message: params.message || "操作完成",
            error: params.error,
        };

        logger.info(`🔧 工作流返回结果: ${result.success ? "成功" : "失败"}`, {
            message: result.message,
            hasData: !!result.data,
            error: result.error,
        });

        return result;
    }

    /**
     * 设置工作流变量
     * 注意：实际的变量设置需要通过ExecutionContext处理
     */
    async setVariable(params: SetVariableParams): Promise<{ success: boolean; message: string }> {
        // 这里只是记录操作，实际的变量设置由WorkflowOrchestrator处理
        logger.info(`🔧 设置工作流变量: ${params.name} = ${JSON.stringify(params.value)}`);

        return {
            success: true,
            message: `变量 ${params.name} 已设置`,
        };
    }

    /**
     * 记录日志信息
     */
    async log(params: LogParams): Promise<{ success: boolean; timestamp: number }> {
        const timestamp = Date.now();

        switch (params.level) {
            case "debug":
                logger.debug(`🔧 [工作流] ${params.message}`, params.metadata);
                break;
            case "info":
                logger.info(`🔧 [工作流] ${params.message}`, params.metadata);
                break;
            case "warn":
                logger.warn(`🔧 [工作流] ${params.message}`, params.metadata);
                break;
            case "error":
                logger.error(`🔧 [工作流] ${params.message}`, params.metadata);
                break;
            default:
                logger.info(`🔧 [工作流] ${params.message}`, params.metadata);
        }

        return {
            success: true,
            timestamp,
        };
    }

    /**
     * 延迟执行
     */
    async delay(params: DelayParams): Promise<{ success: boolean; actualDelay: number }> {
        const startTime = Date.now();

        logger.info(`🔧 延迟执行 ${params.milliseconds}ms`);

        await new Promise((resolve) => setTimeout(resolve, params.milliseconds));

        const actualDelay = Date.now() - startTime;

        logger.info(`🔧 延迟执行完成，实际延迟: ${actualDelay}ms`);

        return {
            success: true,
            actualDelay,
        };
    }

    /**
     * 空操作
     * 用于流程控制，不执行任何实际操作
     */
    async noop(): Promise<{ success: boolean; message: string }> {
        logger.debug("🔧 执行空操作 (noop)");

        return {
            success: true,
            message: "空操作执行完成",
        };
    }

    /**
     * 抛出错误
     * 用于测试错误处理或主动失败某个步骤
     */
    async throwError(params: { message: string; code?: string }): Promise<never> {
        logger.error(`🔧 主动抛出错误: ${params.message}`, { code: params.code });

        const error = new Error(params.message);
        if (params.code) {
            (error as any).code = params.code;
        }

        throw error;
    }

    /**
     * 条件分支
     * 根据条件返回不同的结果
     */
    async branch(params: {
        condition: boolean;
        onTrue?: any;
        onFalse?: any;
    }): Promise<{ success: boolean; result: any; branch: "true" | "false" }> {
        const branch = params.condition ? "true" : "false";
        const result = params.condition ? params.onTrue : params.onFalse;

        logger.info(`🔧 条件分支执行: ${branch}`, { result });

        return {
            success: true,
            result,
            branch,
        };
    }

    /**
     * 数据转换
     * 对输入数据进行简单的转换操作
     */
    async transform(params: {
        input: any;
        operation: "stringify" | "parse" | "keys" | "values" | "length";
    }): Promise<{ success: boolean; result: any; operation: string }> {
        let result: any;

        try {
            switch (params.operation) {
                case "stringify":
                    result = JSON.stringify(params.input);
                    break;
                case "parse":
                    result = JSON.parse(params.input);
                    break;
                case "keys":
                    result = Object.keys(params.input);
                    break;
                case "values":
                    result = Object.values(params.input);
                    break;
                case "length":
                    result = Array.isArray(params.input)
                        ? params.input.length
                        : Object.keys(params.input).length;
                    break;
                default:
                    throw new Error(`不支持的转换操作: ${params.operation}`);
            }

            logger.debug(`🔧 数据转换: ${params.operation}`, { input: params.input, result });

            return {
                success: true,
                result,
                operation: params.operation,
            };
        } catch (error) {
            logger.error(`🔧 数据转换失败: ${params.operation}`, error);
            throw error;
        }
    }
}
