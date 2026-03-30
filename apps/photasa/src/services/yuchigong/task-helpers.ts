/**
 * 扫描任务辅助函数（纯函数）
 * 用于处理扫描任务相关的业务逻辑，无副作用，易于测试
 *
 * @description
 * 纯函数设计，专注于业务逻辑计算，不依赖外部状态
 * 遵循 Linus "Good Taste" 原则：消除特殊情况，统一处理路径
 *
 * @since RFC 0056
 */

import type { ScanQueueItem } from "@renderer/stores/scanning-types";

// ✅ RFC 0056: 提取常量，消除魔法数字
export const HOURS_IN_MILLISECONDS = 60 * 60 * 1000;
export const FAILED_TASK_TTL = 24 * 60 * 60 * 1000; // 24小时

/**
 * 任务状态类型
 */
export type TaskStatus = "pending" | "processing" | "failed";

/**
 * 任务状态对象（用于兼容旧格式任务）
 */
export interface TaskStatusObject {
    status?: TaskStatus;
}

/**
 * 失败任务操作类型
 */
export type FailedTaskAction = "delete-ttl" | "retry" | "delete-max-retries";

/**
 * 计算任务年龄（纯函数）
 *
 * @param now 当前时间戳
 * @param createdAt 任务创建时间戳
 * @returns 任务年龄（毫秒）
 */
export function calculateTaskAge(now: number, createdAt: number): number {
    return now - createdAt;
}

/**
 * 计算任务失败的小时数（纯函数）
 *
 * @param taskAge 任务年龄（毫秒）
 * @returns 失败的小时数（四舍五入）
 */
export function calculateHoursAgo(taskAge: number): number {
    return Math.round(taskAge / HOURS_IN_MILLISECONDS);
}

/**
 * 判断失败任务是否应该删除（基于TTL）（纯函数）
 *
 * @param taskAge 任务年龄（毫秒）
 * @param ttl 任务生存时间（毫秒），默认24小时
 * @returns 是否应该删除
 */
export function shouldDeleteFailedTaskByTTL(
    taskAge: number,
    ttl: number = FAILED_TASK_TTL,
): boolean {
    return taskAge > ttl;
}

/**
 * 判断失败任务是否应该重试（纯函数）
 *
 * @param retryCount 当前重试次数
 * @param maxRetries 最大重试次数
 * @returns 是否应该重试
 */
export function shouldRetryFailedTask(retryCount: number, maxRetries: number): boolean {
    return retryCount < maxRetries;
}

/**
 * 失败任务操作决策（纯函数）
 *
 * @description
 * 根据任务年龄、重试次数等条件，决定对失败任务应该执行的操作。
 * 优先级：超时删除 > 重试 > 达到重试上限删除
 *
 * @param taskAge 任务年龄（毫秒）
 * @param retryCount 当前重试次数
 * @param maxRetries 最大重试次数
 * @param ttl 任务生存时间（毫秒），默认24小时
 * @returns 操作类型：'delete-ttl' | 'retry' | 'delete-max-retries'
 */
export function getFailedTaskAction(
    taskAge: number,
    retryCount: number,
    maxRetries: number,
    ttl: number = FAILED_TASK_TTL,
): FailedTaskAction {
    // 优先级1：超过TTL，删除
    if (shouldDeleteFailedTaskByTTL(taskAge, ttl)) {
        return "delete-ttl";
    }

    // 优先级2：未达到重试上限，重试
    if (shouldRetryFailedTask(retryCount, maxRetries)) {
        return "retry";
    }

    // 优先级3：达到重试上限，删除
    return "delete-max-retries";
}

/**
 * 计算失败任务的下一次重试次数（纯函数）
 *
 * @param currentRetryCount 当前重试次数
 * @returns 下一次重试次数
 */
export function calculateNextRetryCount(currentRetryCount: number): number {
    return currentRetryCount + 1;
}

/**
 * 获取任务状态显示文本（纯函数）
 *
 * @param task 扫描队列任务或任务状态对象
 * @returns 状态显示文本
 */
export function getTaskStatusDisplayText(task: ScanQueueItem | TaskStatusObject): string {
    return task.status || "legacy-pending";
}
