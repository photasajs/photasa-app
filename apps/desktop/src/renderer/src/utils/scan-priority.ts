/**
 * RFC 0018: 扫描文件夹优先级排序工具（修复版）
 *
 * 提供扫描文件夹的优先级计算和排序功能，处理向后兼容性
 *
 * @deprecated 此模块将在 RFC 0048 v3 中被移除，因为优先级管理已被状态机制取代
 */

import type { FileOperationInput } from "@common/scan-types";

/**
 * 优先级规则配置
 * 数值越小优先级越高
 */
export const PRIORITY_RULES = {
    // 基础优先级（按动作类型）
    action: {
        current: 1, // 用户当前选择的文件夹
        rescan: 2, // 重新扫描
        scan: 3, // 普通扫描
    },

    // 来源加成（用户操作优于自动发现）
    source: {
        user: 0, // 用户主动添加
        auto: 10, // 自动发现
    },
} as const;

/**
 * 完整的扫描动作类型（所有字段都必需）
 * @deprecated 使用 FileOperationInput 替代
 */
export type CompleteScanAction = Required<FileOperationInput>;

/**
 * 计算扫描动作的优先级
 */
export function calculatePriority(
    action: FileOperationInput["action"],
    source: NonNullable<FileOperationInput["source"]> = "user",
): number {
    const actionPriority = PRIORITY_RULES.action[action];
    const sourceBonus = PRIORITY_RULES.source[source];

    return actionPriority + sourceBonus;
}

/**
 * 确保扫描动作拥有所有必需的字段
 */
export function ensureCompleteScanAction(scanAction: FileOperationInput): CompleteScanAction {
    const source = scanAction.source || "user";
    const timestamp = scanAction.timestamp || Date.now();
    const priority = scanAction.priority ?? calculatePriority(scanAction.action, source);

    // 操作类型：默认为 directory，walkthroughPhotosInFolder 函数会正确处理单文件扫描
    const operationType = scanAction.operationType || "directory";

    return {
        ...scanAction,
        operationType,
        retryCount: 0,
        priority,
        timestamp,
        source,
    } as CompleteScanAction;
}

/**
 * 创建带优先级信息的扫描动作
 */
export function createScanAction(
    baseScanAction: Omit<FileOperationInput, "priority" | "timestamp" | "source">,
    source: NonNullable<FileOperationInput["source"]> = "user",
): CompleteScanAction {
    const timestamp = Date.now();
    const priority = calculatePriority(baseScanAction.action, source);

    // 操作类型：默认为 directory，walkthroughPhotosInFolder 函数会正确处理单文件扫描
    const operationType = baseScanAction.operationType || "directory";

    return {
        ...baseScanAction,
        priority,
        timestamp,
        source,
        operationType,
        retryCount: baseScanAction.retryCount || 0,
    } as CompleteScanAction;
}

/**
 * 排序函数：按优先级、路径、时间戳排序
 */
export function sortScanningFolders(folders: FileOperationInput[]): FileOperationInput[] {
    return [...folders].map(ensureCompleteScanAction).sort((a, b) => {
        // 1. 按优先级排序（数值越小优先级越高）
        const priorityDiff = a.priority - b.priority;
        if (priorityDiff !== 0) return priorityDiff;

        // 2. 相同优先级按路径字母序排序（保证稳定的排序结果）
        const pathCompare = a.path.localeCompare(b.path);
        if (pathCompare !== 0) return pathCompare;

        // 3. 相同路径按时间戳排序（越新优先级越高）
        return b.timestamp - a.timestamp;
    });
}

/**
 * 更新扫描动作的优先级（保持时间戳不变）
 */
export function updateScanActionPriority(
    scanAction: FileOperationInput,
    newAction?: FileOperationInput["action"],
    newSource?: NonNullable<FileOperationInput["source"]>,
): CompleteScanAction {
    const complete = ensureCompleteScanAction(scanAction);
    const action = newAction || complete.action;
    const source = newSource || complete.source;
    const priority = calculatePriority(action, source);

    return {
        ...complete,
        action,
        source,
        priority,
    };
}

/**
 * 检查是否需要更新现有扫描动作
 */
export function shouldUpdateScanAction(
    existing: FileOperationInput,
    newAction: FileOperationInput["action"],
    newSource: NonNullable<FileOperationInput["source"]>,
): boolean {
    const existingComplete = ensureCompleteScanAction(existing);
    const newPriority = calculatePriority(newAction, newSource);
    return newPriority < existingComplete.priority;
}

/**
 * 获取优先级的可读描述
 */
export function getPriorityDescription(scanAction: FileOperationInput): string {
    const complete = ensureCompleteScanAction(scanAction);
    const actionDesc = {
        current: "current",
        rescan: "rescan",
        scan: "scan",
    };

    const sourceDesc = {
        user: "user",
        auto: "auto",
    };

    return `${actionDesc[complete.action]}(${sourceDesc[complete.source]}) priority:${complete.priority}`;
}

/**
 * 调试函数：打印排序后的文件夹列表
 */
export function debugPrintScanningFolders(
    folders: FileOperationInput[],
    title = "scanning_queue",
): void {
    console.group(`🗂️ ${title} (${folders.length} folders)`);
    folders.forEach((folder, index) => {
        const complete = ensureCompleteScanAction(folder);
        console.log(
            `${index + 1}. ${complete.path}`,
            `- ${getPriorityDescription(complete)}`,
            `- time: ${new Date(complete.timestamp).toLocaleTimeString()}`,
        );
    });
    console.groupEnd();
}
