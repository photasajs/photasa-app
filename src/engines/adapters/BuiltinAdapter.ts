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
    data?: unknown;
    message?: string;
    error?: string;
    // 支持额外的结构化信息，保持向后兼容
    details?: unknown;
    [key: string]: unknown; // 允许扩展字段
}

interface SetVariableParams {
    name: string;
    value: unknown;
}

interface LogParams {
    level: "info" | "warn" | "error" | "debug";
    message: string;
    metadata?: unknown;
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
    async return(params: ReturnParams = {}): Promise<unknown> {
        // 🔧 智能日志：如果params.message存在则显示，否则显示数据摘要
        if (params.message !== undefined) {
            logger.debug(`🔧 收到仙家回禀:`, params.message);
        } else {
            // 如果传入的是任意数据对象（非标准ReturnParams），显示数据摘要
            const {
                success: _success,
                error: _error,
                message: _message,
                details: _details,
                data: _data,
                ...dataFields
            } = params;
            const dataToLog = params.data !== undefined ? params.data : dataFields;

            // 根据数据类型选择合适的日志格式
            if (dataToLog && typeof dataToLog === "object") {
                const keys = Object.keys(dataToLog);
                const preview =
                    keys.length > 0
                        ? `数据字段: ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? `, ... (共${keys.length}个字段)` : ""}`
                        : "空对象";
                logger.debug(`🔧 收到仙家回禀: ${preview}`);
            } else if (dataToLog !== undefined && dataToLog !== null) {
                logger.debug(`🔧 收到仙家回禀:`, dataToLog);
            } else {
                logger.debug(`🔧 收到仙家回禀: (无数据)`);
            }
        }

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

        const error = new Error(params.message) as Error & { code?: string };
        if (params.code) {
            error.code = params.code;
        }

        throw error;
    }

    /**
     * 条件分支
     * 根据条件返回不同的结果
     */
    async branch(params: {
        condition: boolean;
        onTrue?: unknown;
        onFalse?: unknown;
    }): Promise<{ success: boolean; result: unknown; branch: "true" | "false" }> {
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
        input: unknown;
        operation: "stringify" | "parse" | "keys" | "values" | "length";
    }): Promise<{ success: boolean; result: unknown; operation: string }> {
        let result: unknown;

        try {
            switch (params.operation) {
                case "stringify":
                    result = JSON.stringify(params.input);
                    break;
                case "parse":
                    result = JSON.parse(params.input as string);
                    break;
                case "keys":
                    result = Object.keys(params.input as object);
                    break;
                case "values":
                    result = Object.values(params.input as object);
                    break;
                case "length":
                    result = Array.isArray(params.input)
                        ? params.input.length
                        : Object.keys(params.input as object).length;
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
     * 数组连接
     * 连接两个数组，返回新数组
     * RFC 0045: Builtin数组操作增强
     *
     * 遵循数据扁平化策略：直接返回数组，不包装
     */
    async arrayConcat(params: { array1: unknown[]; array2: unknown[] }): Promise<unknown[]> {
        // 最大数组大小限制
        const MAX_ARRAY_SIZE = 100000;

        try {
            // ✅ 容错处理：参数验证使用 fallback + log，不抛出错误

            // array1 容错处理
            if (params.array1 === null || params.array1 === undefined) {
                logger.warn("🔧 array1参数为null或undefined，使用空数组作为默认值");
                params.array1 = [];
            }

            if (!Array.isArray(params.array1)) {
                logger.warn(
                    `🔧 array1参数不是数组类型 (${typeof params.array1})，使用空数组作为默认值`,
                );
                params.array1 = [];
            }

            // array2 容错处理
            if (params.array2 === null || params.array2 === undefined) {
                logger.warn("🔧 array2参数为null或undefined，使用空数组作为默认值");
                params.array2 = [];
            }

            if (!Array.isArray(params.array2)) {
                logger.warn(
                    `🔧 array2参数不是数组类型 (${typeof params.array2})，使用空数组作为默认值`,
                );
                params.array2 = [];
            }

            // ✅ 大小限制检查：仅记录警告，不截断
            // 实际场景中很少会遇到超过 100000 个元素的情况
            // 如果真的超过，记录警告但继续执行，让调用者决定如何处理
            const totalLength = params.array1.length + params.array2.length;
            if (totalLength > MAX_ARRAY_SIZE) {
                logger.warn(
                    `🔧 合并后数组过大 (${totalLength}个元素)，最大建议${MAX_ARRAY_SIZE}个元素，继续执行`,
                );
            }

            // 纯函数：创建新数组
            const result = [...params.array1, ...params.array2];

            logger.debug(`🔧 施展连接之术`, {
                array1Length: params.array1.length,
                array2Length: params.array2.length,
                resultLength: result.length,
            });

            // 直接返回数组，无包装
            return result;
        } catch (error) {
            logger.error(`🔧 连接之术失败: ${(error as Error).message}`, {
                operation: "arrayConcat",
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
        let result: unknown = obj;

        for (const key of keys) {
            if (result === null || result === undefined) {
                return undefined;
            }
            result = (result as Record<string, unknown>)[key];
        }

        return result;
    }

    /**
     * 数组查找
     * 在数组中查找满足条件的元素或其索引
     * RFC 0048 v3: 扫描状态机工作流支持
     *
     * @param params.array - 要搜索的数组
     * @param params.predicate - 查找条件（字符串表达式或对象条件）
     * @param params.returnIndex - 是否返回索引（默认返回元素）
     * @returns 找到的元素或索引，未找到时返回 undefined 或 -1
     */
    async arrayFind(params: {
        array: unknown[];
        predicate: string | { field: string; value: unknown };
        returnIndex?: boolean;
    }): Promise<unknown> {
        try {
            // 参数验证
            if (params.array === null || params.array === undefined) {
                throw new Error("array参数不能为null或undefined");
            }

            if (!Array.isArray(params.array)) {
                throw new Error(`array参数必须是数组类型，当前类型: ${typeof params.array}`);
            }

            if (!params.predicate) {
                throw new Error("predicate参数不能为空");
            }

            let findFn: (item: unknown, index: number) => boolean;

            // 解析谓词
            if (typeof params.predicate === "string") {
                // 字符串表达式，如 "item.path === inputs.path"
                // 由于模板变量在工作流引擎层面已解析，这里 predicate 应该是已解析的值
                // 如果是简单的相等比较 "item.path === 某值"，需要特殊处理
                const predicateStr = params.predicate;
                findFn = (item: unknown) => {
                    // 尝试解析简单的相等表达式
                    const match = predicateStr.match(/^item\.(\w+)\s*===\s*(.+)$/);
                    if (match) {
                        const [, field, valueStr] = match;
                        const itemValue = this.getNestedValue(item, field);
                        // 尝试解析值（去掉引号如果有的话）
                        let expectedValue: unknown = valueStr.trim();
                        if (
                            (expectedValue as string).startsWith('"') &&
                            (expectedValue as string).endsWith('"')
                        ) {
                            expectedValue = (expectedValue as string).slice(1, -1);
                        } else if (
                            (expectedValue as string).startsWith("'") &&
                            (expectedValue as string).endsWith("'")
                        ) {
                            expectedValue = (expectedValue as string).slice(1, -1);
                        }
                        return itemValue === expectedValue;
                    }
                    // 如果无法解析，返回 false
                    logger.warn(`🔧 无法解析查找条件: ${predicateStr}`);
                    return false;
                };
            } else {
                // 对象条件，如 { field: "path", value: "/some/path" }
                const predicateObj = params.predicate;
                findFn = (item: unknown) => {
                    const itemValue = this.getNestedValue(item, predicateObj.field);
                    return itemValue === predicateObj.value;
                };
            }

            // 执行查找
            if (params.returnIndex) {
                const index = params.array.findIndex(findFn);
                logger.debug(`🔧 施展寻觅之术: 索引=${index}`, {
                    arrayLength: params.array.length,
                    predicate: params.predicate,
                });
                return index;
            } else {
                const found = params.array.find(findFn);
                logger.debug(`🔧 施展寻觅之术: ${found ? "觅得真物" : "无果而终"}`, {
                    arrayLength: params.array.length,
                    predicate: params.predicate,
                });
                return found;
            }
        } catch (error) {
            logger.error(`🔧 寻觅之术失败: ${(error as Error).message}`, {
                operation: "arrayFind",
                error,
            });
            throw error;
        }
    }

    /**
     * 条件判断
     * 根据条件返回不同的结果
     * RFC 0048 v3: 扫描状态机工作流支持
     *
     * @param params.condition - 条件（布尔值或可求值为布尔的表达式结果）
     * @param params.onTrue - 条件为真时返回的值
     * @param params.onFalse - 条件为假时返回的值
     * @returns onTrue 或 onFalse 的值
     */
    async conditional(params: {
        condition: boolean | number | string;
        onTrue?: unknown;
        onFalse?: unknown;
    }): Promise<unknown> {
        try {
            // 将条件转换为布尔值
            let conditionResult: boolean;

            if (typeof params.condition === "boolean") {
                conditionResult = params.condition;
            } else if (typeof params.condition === "number") {
                // 数字：0 为 false，其他为 true
                // 特殊情况：-1 常用于表示"未找到"，应视为 false
                conditionResult = params.condition >= 0;
            } else if (typeof params.condition === "string") {
                // 字符串：尝试解析简单的比较表达式
                const trimmed = params.condition.trim().toLowerCase();
                if (trimmed === "true") {
                    conditionResult = true;
                } else if (trimmed === "false") {
                    conditionResult = false;
                } else {
                    // 尝试解析数值比较
                    const numMatch = params.condition.match(
                        /^(-?\d+)\s*(>=|>|<=|<|===|==|!==|!=)\s*(-?\d+)$/,
                    );
                    if (numMatch) {
                        const [, leftStr, operator, rightStr] = numMatch;
                        const left = Number(leftStr);
                        const right = Number(rightStr);
                        switch (operator) {
                            case ">=":
                                conditionResult = left >= right;
                                break;
                            case ">":
                                conditionResult = left > right;
                                break;
                            case "<=":
                                conditionResult = left <= right;
                                break;
                            case "<":
                                conditionResult = left < right;
                                break;
                            case "===":
                            case "==":
                                conditionResult = left === right;
                                break;
                            case "!==":
                            case "!=":
                                conditionResult = left !== right;
                                break;
                            default:
                                conditionResult = false;
                        }
                    } else {
                        // 无法解析，非空字符串视为 true
                        conditionResult = trimmed.length > 0;
                    }
                }
            } else {
                // 其他类型：truthy/falsy 判断
                conditionResult = Boolean(params.condition);
            }

            const result = conditionResult ? params.onTrue : params.onFalse;

            logger.debug(`🔧 施展判断之术: ${conditionResult ? "阳" : "阴"}`, {
                condition: params.condition,
                branch: conditionResult ? "onTrue" : "onFalse",
            });

            return result;
        } catch (error) {
            logger.error(`🔧 判断之术失败: ${(error as Error).message}`, {
                operation: "conditional",
                error,
            });
            throw error;
        }
    }

    /**
     * 数组取值
     * 获取数组指定索引的元素
     * RFC 0048 v3: 扫描状态机工作流支持
     *
     * @param params.array - 要访问的数组
     * @param params.index - 索引（支持负数，-1 表示最后一个元素）
     * @returns 指定索引的元素，索引越界时返回 undefined
     */
    async arrayGet(params: { array: unknown[]; index: number }): Promise<unknown> {
        try {
            // 参数验证
            if (params.array === null || params.array === undefined) {
                throw new Error("array参数不能为null或undefined");
            }

            if (!Array.isArray(params.array)) {
                throw new Error(`array参数必须是数组类型，当前类型: ${typeof params.array}`);
            }

            if (typeof params.index !== "number" || isNaN(params.index)) {
                throw new Error(`index参数必须是有效数字，当前值: ${params.index}`);
            }

            // 处理负数索引
            let actualIndex = params.index;
            if (actualIndex < 0) {
                actualIndex = params.array.length + actualIndex;
            }

            // 边界检查
            if (actualIndex < 0 || actualIndex >= params.array.length) {
                logger.warn(
                    `🔧 取值之术：索引越界 (index=${params.index}, length=${params.array.length})`,
                );
                return undefined;
            }

            const result = params.array[actualIndex];

            logger.debug(`🔧 施展取值之术: 索引=${params.index}`, {
                arrayLength: params.array.length,
                actualIndex,
                hasResult: result !== undefined,
            });

            return result;
        } catch (error) {
            logger.error(`🔧 取值之术失败: ${(error as Error).message}`, {
                operation: "arrayGet",
                error,
            });
            throw error;
        }
    }

    /**
     * 对象合并
     * 合并多个对象（浅合并）
     * RFC 0048 v3: 扫描状态机工作流支持
     *
     * @param params.base - 基础对象
     * @param params.updates - 更新对象
     * @param params.additional - 额外更新对象（可选）
     * @returns 合并后的新对象
     */
    async objectMerge(params: {
        base: Record<string, unknown>;
        updates: Record<string, unknown>;
        additional?: Record<string, unknown>;
    }): Promise<Record<string, unknown>> {
        try {
            // 参数验证
            if (params.base === null || params.base === undefined) {
                throw new Error("base参数不能为null或undefined");
            }

            if (typeof params.base !== "object") {
                throw new Error(`base参数必须是对象类型，当前类型: ${typeof params.base}`);
            }

            // 执行合并
            const result = {
                ...params.base,
                ...params.updates,
                ...(params.additional || {}),
            };

            logger.debug(`🔧 施展融合之术: 合并${Object.keys(result).length}个字段`, {
                baseKeys: Object.keys(params.base),
                updateKeys: Object.keys(params.updates),
            });

            return result;
        } catch (error) {
            logger.error(`🔧 融合之术失败: ${(error as Error).message}`, {
                operation: "objectMerge",
                error,
            });
            throw error;
        }
    }

    /**
     * 数组设值
     * 设置数组指定索引的元素（纯函数，返回新数组）
     * RFC 0048 v3: 扫描状态机工作流支持
     *
     * @param params.array - 要操作的数组
     * @param params.index - 索引（支持负数）
     * @param params.value - 新值
     * @returns 更新后的新数组
     */
    async arraySet(params: {
        array: unknown[];
        index: number;
        value: unknown;
    }): Promise<unknown[]> {
        try {
            // 参数验证
            if (params.array === null || params.array === undefined) {
                throw new Error("array参数不能为null或undefined");
            }

            if (!Array.isArray(params.array)) {
                throw new Error(`array参数必须是数组类型，当前类型: ${typeof params.array}`);
            }

            if (typeof params.index !== "number" || isNaN(params.index)) {
                throw new Error(`index参数必须是有效数字，当前值: ${params.index}`);
            }

            // 处理负数索引
            let actualIndex = params.index;
            if (actualIndex < 0) {
                actualIndex = params.array.length + actualIndex;
            }

            // 边界检查
            if (actualIndex < 0 || actualIndex >= params.array.length) {
                throw new Error(`索引越界: index=${params.index}, length=${params.array.length}`);
            }

            // 纯函数：创建新数组
            const result = [...params.array];
            result[actualIndex] = params.value;

            logger.debug(`🔧 施展置换之术: 索引=${params.index}`, {
                arrayLength: params.array.length,
            });

            return result;
        } catch (error) {
            logger.error(`🔧 置换之术失败: ${(error as Error).message}`, {
                operation: "arraySet",
                error,
            });
            throw error;
        }
    }
}
