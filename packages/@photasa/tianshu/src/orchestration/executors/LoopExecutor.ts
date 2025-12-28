/**
 * 驺吾循环执行器
 * 负责处理循环步骤的迭代执行
 *
 * 平台中立：不依赖Node.js或浏览器特定API
 */

import { Logger } from "../../types/runtime-interfaces";
import type { LoopStep } from "@zouwu-wf/workflow";

/**
 * 循环执行结果
 */
export interface LoopResult {
    success: boolean;
    result: any[];
    stepType: "loop";
    stepId: string;
    iterationCount: number;
    breakIndex?: number;
}

/**
 * 循环上下文
 */
export interface LoopContext {
    item: any;
    index: number;
    total: number;
    isFirst: boolean;
    isLast: boolean;
}

/**
 * 循环执行器
 */
export class LoopExecutor {
    constructor(_logger?: Logger) {
        // Logger unused but kept for interface compatibility
    }

    /**
     * 获取循环源表达式
     */
    getSource(step: LoopStep): any {
        if (step.iterator) {
            return step.iterator.source;
        }
        if (step.loop) {
            return step.loop.count;
        }
        return undefined;
    }

    /**
     * 准备迭代数据
     */
    prepareIterations(step: LoopStep, resolvedData: any): any[] {
        // 新格式：使用iterator
        if (step.iterator) {
            const source =
                resolvedData !== undefined && resolvedData !== null
                    ? resolvedData
                    : step.iterator.source;

            if (Array.isArray(source)) {
                return source;
            } else if (typeof source === "object" && source !== null) {
                // 对象转为键值对数组
                return Object.entries(source).map(([key, value]) => ({ key, value }));
            } else if (typeof source === "number") {
                // 数字转为索引数组
                return Array.from({ length: source }, (_, i) => i);
            }
        }

        // 旧格式：使用loop.count（向后兼容）
        if (step.loop && step.loop.count !== undefined) {
            const count =
                resolvedData !== undefined && resolvedData !== null
                    ? resolvedData
                    : step.loop.count;

            if (typeof count === "number") {
                return Array.from({ length: count }, (_, i) => i);
            } else if (Array.isArray(count)) {
                return count;
            }
        }

        throw new Error(
            `Invalid loop configuration in step ${step.id || step.name}: missing iterator or count`,
        );
    }

    /**
     * 创建循环上下文
     */
    createLoopContext(item: any, index: number, total: number): LoopContext {
        return {
            item,
            index,
            total,
            isFirst: index === 0,
            isLast: index === total - 1,
        };
    }

    /**
     * 获取循环变量名
     */
    getVariableName(step: LoopStep): string {
        return step.iterator?.variable || step.loop?.variable || "item";
    }

    /**
     * 获取索引变量名
     */
    getIndexName(step: LoopStep): string {
        return step.iterator?.index || "index";
    }
}
