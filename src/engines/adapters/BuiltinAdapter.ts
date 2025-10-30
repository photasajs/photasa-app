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
    // 支持额外的结构化信息，保持向后兼容
    details?: any;
    [key: string]: any; // 允许扩展字段
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
        logger.info("🔧 内置仙术已备，诸般法器就绪");
    }

    /**
     * 关闭适配器
     */
    async shutdown(): Promise<void> {
        logger.info("🔧 内置仙术收功，法器归位");
    }

    /**
     * 返回工作流结果
     * 用于工作流步骤返回最终结果
     * 直接返回数据，避免不必要的包装
     */
    async return(params: ReturnParams = {}): Promise<any> {
        logger.debug(`🔧 收到仙家回禀:`, params.message);

        // 如果有错误，抛出异常而不是返回包装结构
        if (params.error) {
            const errorDetails = params.details ? ` 详情: ${JSON.stringify(params.details)}` : "";
            logger.error(`🔧 仙令有误: ${params.error}${errorDetails}`);
            throw new Error(params.error);
        }

        // 如果明确失败，抛出异常
        if (params.success === false) {
            const errorMsg = params.message || "操作失败";
            const errorDetails = params.details ? ` 详情: ${JSON.stringify(params.details)}` : "";
            logger.error(`🔧 功败垂成: ${errorMsg}${errorDetails}`);
            throw new Error(errorMsg);
        }

        // ✅ RFC 0042: 如果有data字段，返回data；否则返回所有非控制字段
        const {
            success: _success,
            error: _error,
            message: _message,
            details: _details,
            ...dataFields
        } = params;
        const result = params.data !== undefined ? params.data : dataFields;

        logger.info(`🔧 仙令已成: 大功告成`, {
            message: params.message || "操作完成",
            hasData: !!result,
            details: params.details,
        });

        return result;
    }

    /**
     * 设置工作流变量
     * 注意：实际的变量设置需要通过ExecutionContext处理
     */
    async setVariable(params: SetVariableParams): Promise<{ success: boolean; message: string }> {
        // 这里只是记录操作，实际的变量设置由WorkflowOrchestrator处理
        logger.info(`🔧 铭刻仙符: 「${params.name}」赋灵为 ${JSON.stringify(params.value)}`);

        return {
            success: true,
            message: `仙符「${params.name}」已铭刻`,
        };
    }

    /**
     * 记录日志信息
     */
    async log(params: LogParams): Promise<{ success: boolean; timestamp: number }> {
        const timestamp = Date.now();

        switch (params.level) {
            case "debug":
                logger.debug(`🔧 【密语】${params.message}`, params.metadata);
                break;
            case "info":
                logger.info(`🔧 【奏报】${params.message}`, params.metadata);
                break;
            case "warn":
                logger.warn(`🔧 【警示】${params.message}`, params.metadata);
                break;
            case "error":
                logger.error(`🔧 【急报】${params.message}`, params.metadata);
                break;
            default:
                logger.info(`🔧 【奏报】${params.message}`, params.metadata);
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

        logger.info(`🔧 静待天时，须臾${params.milliseconds}毫秒`);

        await new Promise((resolve) => setTimeout(resolve, params.milliseconds));

        const actualDelay = Date.now() - startTime;

        logger.info(`🔧 天时已至，恰逢${actualDelay}毫秒`);

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
        logger.debug("🔧 无为而治，不动如山");

        return {
            success: true,
            message: "无为之术已施",
        };
    }

    /**
     * 抛出错误
     * 用于测试错误处理或主动失败某个步骤
     */
    async throwError(params: { message: string; code?: string }): Promise<never> {
        logger.error(`🔧 天劫降临: ${params.message}`, { code: params.code });

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

        logger.info(`🔧 分道扬镳，择${branch === "true" ? "阳" : "阴"}而行`, { result });

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

            logger.debug(`🔧 施展转化之术: ${params.operation}`, {
                input: params.input,
                result,
            });

            return {
                success: true,
                result,
                operation: params.operation,
            };
        } catch (error) {
            logger.error(`🔧 转化之术失败，法力耗尽: ${params.operation}`, error);
            throw error;
        }
    }

    /**
     * 数组追加
     * 追加元素到数组末尾（纯函数，返回新数组）
     * RFC 0045: Builtin数组操作增强
     *
     * 遵循数据扁平化策略：直接返回数组，不包装
     */
    async arrayAppend(params: { array: unknown[]; item: unknown }): Promise<unknown[]> {
        // 最大数组大小限制
        const MAX_ARRAY_SIZE = 100000;

        try {
            // 参数验证
            if (params.array === null || params.array === undefined) {
                throw new Error("array参数不能为null或undefined");
            }

            if (!Array.isArray(params.array)) {
                throw new Error(`array参数必须是数组类型，当前类型: ${typeof params.array}`);
            }

            // 大小限制检查
            if (params.array.length >= MAX_ARRAY_SIZE) {
                throw new Error(`数组过大，最大支持${MAX_ARRAY_SIZE}个元素`);
            }

            // 纯函数：创建新数组
            const result = [...params.array, params.item];

            logger.debug(`🔧 施展合并之术`, {
                arrayLength: params.array.length,
                itemType: typeof params.item,
                resultLength: result.length,
            });

            // 直接返回数组，无包装
            return result;
        } catch (error) {
            logger.error(`🔧 合并之术失败: ${(error as Error).message}`, {
                operation: "arrayAppend",
                error,
            });
            throw error;
        }
    }

    /**
     * 数组计数
     * 计算数组元素数量
     * RFC 0045: Builtin数组操作增强
     *
     * 遵循数据扁平化策略：直接返回数字，不包装
     */
    async arrayCount(params: { array: unknown[] }): Promise<number> {
        try {
            // 参数验证
            if (params.array === null || params.array === undefined) {
                throw new Error("array参数不能为null或undefined");
            }

            if (!Array.isArray(params.array)) {
                throw new Error(`array参数必须是数组类型，当前类型: ${typeof params.array}`);
            }

            const result = params.array.length;

            logger.debug(`🔧 施展计数之术: 得${result}个元素`);

            // 直接返回数字，无包装
            return result;
        } catch (error) {
            logger.error(`🔧 计数之术失败: ${(error as Error).message}`, {
                operation: "arrayCount",
                error,
            });
            throw error;
        }
    }

    /**
     * 数组过滤
     * 根据条件过滤数组元素（纯函数，返回新数组）
     * RFC 0045: Builtin数组操作增强
     *
     * 遵循数据扁平化策略：直接返回数组，不包装
     */
    async arrayFilter(params: {
        array: unknown[];
        condition: {
            field: string;
            operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte";
            value: unknown;
        };
    }): Promise<unknown[]> {
        // 最大数组大小限制
        const MAX_ARRAY_SIZE = 100000;

        try {
            // 参数验证
            if (params.array === null || params.array === undefined) {
                throw new Error("array参数不能为null或undefined");
            }

            if (!Array.isArray(params.array)) {
                throw new Error(`array参数必须是数组类型，当前类型: ${typeof params.array}`);
            }

            if (!params.condition || !params.condition.field || !params.condition.operator) {
                throw new Error("condition参数结构错误，必须包含field和operator");
            }

            // 大小限制检查
            if (params.array.length > MAX_ARRAY_SIZE) {
                throw new Error(`数组过大，最大支持${MAX_ARRAY_SIZE}个元素`);
            }

            // 支持的操作符
            const validOperators = ["eq", "ne", "gt", "lt", "gte", "lte"];
            if (!validOperators.includes(params.condition.operator)) {
                throw new Error(
                    `不支持的操作符: ${params.condition.operator}，支持: ${validOperators.join(", ")}`,
                );
            }

            // 纯函数：过滤数组
            const result = params.array.filter((item) => {
                // 安全地获取嵌套字段值
                const fieldValue = this.getNestedValue(item, params.condition.field);
                const expectedValue = params.condition.value;

                // 根据操作符比较
                switch (params.condition.operator) {
                    case "eq":
                        return fieldValue === expectedValue;
                    case "ne":
                        return fieldValue !== expectedValue;
                    case "gt":
                        return (fieldValue as number) > (expectedValue as number);
                    case "lt":
                        return (fieldValue as number) < (expectedValue as number);
                    case "gte":
                        return (fieldValue as number) >= (expectedValue as number);
                    case "lte":
                        return (fieldValue as number) <= (expectedValue as number);
                    default:
                        return false;
                }
            });

            logger.debug(`🔧 施展筛选之术`, {
                condition: params.condition,
                inputCount: params.array.length,
                resultCount: result.length,
            });

            // 直接返回数组，无包装
            return result;
        } catch (error) {
            logger.error(`🔧 筛选之术失败: ${(error as Error).message}`, {
                operation: "arrayFilter",
                error,
            });
            throw error;
        }
    }

    /**
     * 获取对象的嵌套字段值
     * 支持路径如 "user.profile.name"
     * @private
     */
    private getNestedValue(obj: unknown, path: string): unknown {
        if (obj === null || obj === undefined) {
            return undefined;
        }

        const keys = path.split(".");
        let result: any = obj;

        for (const key of keys) {
            if (result === null || result === undefined) {
                return undefined;
            }
            result = (result as Record<string, unknown>)[key];
        }

        return result;
    }
}
