import { StepResult, WorkflowStep } from "../types/workflows";
import type { Logger } from "@systembug/diting";

/**
 * 生成UUID
 * 注意：此函数使用Math.random()，不是严格的纯函数，但被允许作为例外
 */
export function generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * 生成执行ID
 * 注意：此函数使用Date.now()和Math.random()，不是严格的纯函数，但被允许作为例外
 */
export function generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 验证数据类型
 * 纯函数：检查数据是否匹配指定类型
 *
 * @param value - 要验证的值
 * @param expectedType - 期望的类型
 * @param path - 字段路径
 * @returns 错误消息（如果验证失败），或null（如果验证通过）
 */
export function validateType(value: unknown, expectedType: string, path: string): string | null {
    const actualType = Array.isArray(value) ? "array" : typeof value;

    // 类型映射
    const typeMap: Record<string, string[]> = {
        string: ["string"],
        number: ["number"],
        boolean: ["boolean"],
        object: ["object"],
        array: ["array"],
    };

    const validTypes = typeMap[expectedType] || [];
    if (validTypes.length === 0) {
        return `未知类型「${expectedType}」在字段「${path}」`;
    }

    if (!validTypes.includes(actualType)) {
        return `字段「${path}」类型错误，期望: ${expectedType}，实际: ${actualType}`;
    }

    return null;
}

/**
 * 解析输出路径
 * 纯函数：只读取数据，不修改任何输入
 *
 * @param data - 要解析的数据
 * @param path - 路径
 * @returns 解析后的数据
 */
export function resolveOutputPath(data: unknown, path: string): unknown {
    if (!path || !data) {
        return data;
    }

    // 简单的路径解析，支持点号分隔的路径
    const parts = path.split(".");
    let current = data;

    for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
            current = (current as any)[part];
        } else {
            return undefined;
        }
    }

    return current;
}

/**
 * 从步骤定义中提取输出
 */
export function extractOutputFromStep(
    step: WorkflowStep,
    stepResult: StepResult,
    logger: Logger,
): Record<string, any> {
    const outputConfig = (step as any).output;
    if (!outputConfig || !stepResult.output) {
        return stepResult.output || {};
    }

    const output: Record<string, any> = {};

    // 根据步骤的output定义提取数据
    for (const [outputKey, outputPath] of Object.entries(outputConfig as Record<string, string>)) {
        try {
            output[outputKey] = resolveOutputPath(stepResult.output, outputPath);
        } catch (error) {
            logger.warn(`提取步骤输出 ${outputKey} 失败:`, error);
            output[outputKey] = undefined;
        }
    }

    return output;
}
