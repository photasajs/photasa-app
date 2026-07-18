/**
 * 工作流标准化工具函数
 * 遵循纯函数黄金法则，将复杂逻辑提取为独立的纯函数
 */

import { HunyuanWorkflowStepOutput } from "./types";

/**
 * 引擎调用结果接口
 */
export interface EngineCallResult<T = unknown> {
    success: boolean;
    result?: T;
    error?: Error;
    timestamp: number;
    engineName: string;
}

/**
 * 规范化工作流步骤输出 - 纯函数版本
 * 将引擎调用结果转换为标准的工作流步骤输出格式
 *
 * @param engineResult 引擎调用结果
 * @param stepId 步骤ID
 * @param startTime 开始时间戳
 * @returns 规范化的混元工作流步骤输出
 */
export function normalizeWorkflowStepOutput<T>(
    engineResult: EngineCallResult<T>,
    stepId: string,
    startTime: number,
): HunyuanWorkflowStepOutput<T> {
    const duration = Date.now() - startTime;

    if (engineResult.success) {
        return createSuccessOutput(engineResult, stepId, duration);
    } else {
        return createErrorOutput(engineResult, stepId, duration);
    }
}

/**
 * 创建成功输出 - 纯函数
 * @param engineResult 引擎调用结果
 * @param stepId 步骤ID
 * @param duration 执行耗时
 * @returns 成功的工作流步骤输出
 */
function createSuccessOutput<T>(
    engineResult: EngineCallResult<T>,
    stepId: string,
    duration: number,
): HunyuanWorkflowStepOutput<T> {
    return {
        success: true,
        data: engineResult.result as T,
        metadata: {
            stepId,
            executedAt: engineResult.timestamp,
            duration,
            engineName: engineResult.engineName,
        },
    };
}

/**
 * 创建错误输出 - 纯函数
 * @param engineResult 引擎调用结果
 * @param stepId 步骤ID
 * @param duration 执行耗时
 * @returns 错误的工作流步骤输出
 */
function createErrorOutput<T>(
    engineResult: EngineCallResult<T>,
    stepId: string,
    duration: number,
): HunyuanWorkflowStepOutput<T> {
    return {
        success: false,
        data: null as T,
        error: extractErrorMessage(engineResult.error),
        metadata: {
            stepId,
            executedAt: engineResult.timestamp,
            duration,
            engineName: engineResult.engineName,
        },
    };
}

/**
 * 提取错误消息 - 纯函数
 * @param error 错误对象
 * @returns 错误消息字符串
 */
function extractErrorMessage(error?: Error): string {
    return error?.message || "Unknown error";
}

/**
 * 计算执行耗时 - 纯函数
 * @param startTime 开始时间戳
 * @returns 执行耗时（毫秒）
 */
export function calculateDuration(startTime: number): number {
    return Date.now() - startTime;
}

/**
 * 验证引擎调用结果 - 纯函数
 * @param engineResult 引擎调用结果
 * @returns 是否为有效的引擎调用结果
 */
export function isValidEngineResult<T>(engineResult: unknown): engineResult is EngineCallResult<T> {
    return (
        typeof engineResult === "object" &&
        engineResult !== null &&
        "success" in engineResult &&
        "timestamp" in engineResult &&
        "engineName" in engineResult
    );
}
