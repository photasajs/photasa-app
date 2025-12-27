/**
 * 驺吾条件执行器
 * 负责评估条件表达式和执行条件分支
 *
 * 平台中立：不依赖Node.js或浏览器特定API
 */

import { Logger } from "../../types/runtime-interfaces";
import type { Condition } from "@zouwu-wf/workflow";

/**
 * 条件执行器
 */
export class ConditionExecutor {
    private logger?: Logger;

    constructor(logger?: Logger) {
        this.logger = logger;
    }

    /**
     * 评估条件表达式
     */
    evaluateCondition(condition: Condition, fieldValue: any): boolean {
        const { operator, value } = condition;

        // Handle aliases or loose types
        const op = operator as string;

        this.logger?.debug?.(`Evaluating condition: ${op}, field=${fieldValue}, value=${value}`);

        switch (op) {
            case "eq":
            case "equals":
                return fieldValue === value;

            case "ne":
            case "notEquals":
                return fieldValue !== value;

            case "gt":
                return fieldValue > value;

            case "gte":
                return fieldValue >= value;

            case "lt":
                return fieldValue < value;

            case "lte":
                return fieldValue <= value;

            case "in":
                return Array.isArray(value) && value.includes(fieldValue);

            case "nin":
            case "notIn":
            case "not_in":
                return Array.isArray(value) && !value.includes(fieldValue);

            case "exists":
                return fieldValue !== undefined && fieldValue !== null;

            case "notExists":
            case "not_exists":
                return fieldValue === undefined || fieldValue === null;

            case "startsWith":
                return typeof fieldValue === "string" && fieldValue.startsWith(String(value));

            case "endsWith":
                return typeof fieldValue === "string" && fieldValue.endsWith(String(value));

            case "contains":
                return typeof fieldValue === "string" && fieldValue.includes(String(value));

            case "matches":
                if (typeof fieldValue === "string" && typeof value === "string") {
                    const regex = new RegExp(value);
                    return regex.test(fieldValue);
                }
                return false;

            case "isEmpty":
                return (
                    !fieldValue ||
                    (typeof fieldValue === "string" && fieldValue.trim() === "") ||
                    (Array.isArray(fieldValue) && fieldValue.length === 0) ||
                    (typeof fieldValue === "object" && Object.keys(fieldValue).length === 0)
                );

            case "isNotEmpty":
                return Boolean(
                    fieldValue &&
                    !(typeof fieldValue === "string" && fieldValue.trim() === "") &&
                    !(Array.isArray(fieldValue) && fieldValue.length === 0) &&
                    !(typeof fieldValue === "object" && Object.keys(fieldValue).length === 0),
                );

            case "string_maxlen":
                return typeof fieldValue === "string" && fieldValue.length <= value;

            case "string_minlen":
                return typeof fieldValue === "string" && fieldValue.length >= value;

            case "optional_string_maxlen":
                if (fieldValue === undefined || fieldValue === null) {
                    return true;
                }
                return typeof fieldValue === "string" && fieldValue.length <= value;

            case "optional_string_minlen":
                if (fieldValue === undefined || fieldValue === null) {
                    return true;
                }
                return typeof fieldValue === "string" && fieldValue.length >= value;

            case "and":
                // 逻辑与：value应该是条件数组
                if (Array.isArray(value)) {
                    return value.every((cond: Condition) =>
                        this.evaluateCondition(cond, fieldValue),
                    );
                }
                return false;

            case "or":
                // 逻辑或：value应该是条件数组
                if (Array.isArray(value)) {
                    return value.some((cond: Condition) =>
                        this.evaluateCondition(cond, fieldValue),
                    );
                }
                return false;

            default:
                this.logger?.warn?.(`Unknown operator: ${op}`);
                return false;
        }
    }

    /**
     * 获取条件结果摘要（用于日志）
     */
    getConditionSummary(condition: Condition): string {
        return `${condition.field || ""} ${condition.operator} ${JSON.stringify(condition.value)}`;
    }
}
