/**
 * scan-orchestrator.ts
 *
 * 扫描编排器 - 纯函数设计，便于测试
 * 分离扫描逻辑与副作用操作
 */

import type { ScanAction } from "@common/scan-types";

// ============= 类型定义 =============

/**
 * 扫描处理器回调接口
 * 将所有副作用操作通过回调传入
 */
export interface ScanCallbacks {
    // 日志回调
    logInfo: (message: string, ...args: any[]) => void;
    logDebug: (message: string, ...args: any[]) => void;
    logError: (message: string, error?: any) => void;

    // 状态更新回调
    updateProcessingStatus: (message: string) => void;
    updateFileProgress: (fileName: string, current?: number, total?: number) => void;
    clearProcessingStatus: () => void;
    updateFolderTree: (path: string) => void;
    completeScanPath: (path: string) => void;

    // 国际化
    t: (key: string, params?: Record<string, any>) => string;

    // 扫描操作回调
    scanSubfolders: (path: string) => Promise<string[]>;
    addScanFolderToQueue: (path: string, action: string) => void;
    performScanTask: (action: ScanAction) => Promise<any>;
    resetPhotasaConfig: (path: string) => Promise<void>;

    // 路径处理回调
    extractParentDir: (path: string) => string | null;

    // 控制回调
    scheduleNextScan: () => void;
}

/**
 * 扫描决策结果
 */
export interface ScanDecision {
    shouldProcessSubfolders: boolean;
    shouldUpdateParentFolder: boolean;
    parentFolderPath?: string;
    subfolders?: string[];
}

/**
 * 扫描执行结果
 */
export interface ScanExecutionResult {
    success: boolean;
    error?: Error;
    shouldContinue: boolean;
}

// ============= 纯函数：扫描决策 =============

/**
 * 纯函数：根据扫描动作决定处理策略
 */
export function decideScanStrategy(scanAction: ScanAction): ScanDecision {
    const isFileOperation = scanAction.operationType === "file";

    return {
        shouldProcessSubfolders: !isFileOperation,
        shouldUpdateParentFolder: isFileOperation,
        parentFolderPath: isFileOperation ? scanAction.path : undefined,
    };
}

/**
 * 纯函数：验证扫描动作的有效性
 */
export function validateScanAction(scanAction: ScanAction | null): {
    isValid: boolean;
    error?: string;
} {
    if (!scanAction) {
        return { isValid: false, error: "No scan action provided" };
    }

    if (!scanAction.path) {
        return { isValid: false, error: "Scan action missing path" };
    }

    return { isValid: true };
}

/**
 * 纯函数：从队列中获取下一个扫描项
 */
export function getNextScanItem<T extends { path: string }>(queue: T[]): T | null {
    return queue.length > 0 ? queue[0] : null;
}

// ============= 异步纯函数：扫描执行 =============

/**
 * 异步纯函数：执行文件夹策略处理
 */
export async function executeDirectoryStrategy(
    scanAction: ScanAction,
    callbacks: ScanCallbacks,
): Promise<ScanDecision> {
    callbacks.logInfo(`[扫描编排] 目录操作，开始扫描子文件夹: ${scanAction.path}`);

    try {
        const folders = await callbacks.scanSubfolders(scanAction.path);

        callbacks.logInfo(`[扫描编排] 发现子文件夹数量: ${folders.length}`);
        if (folders.length > 0) {
            callbacks.logDebug(`[扫描编排] 子文件夹列表:`, folders);

            // 添加子文件夹到队列 - 使用"auto"来源以区分用户手动添加
            folders.forEach((folderPath: string) => {
                callbacks.logDebug(`[扫描编排] 添加子文件夹到队列: ${folderPath}`);
                // 注意：这里应该调用 addScanFolderWithLog 而不是 addScanFolderToQueue
                // 以确保传递正确的source参数
                callbacks.addScanFolderToQueue(folderPath, "scan");
            });

            callbacks.logInfo(`[扫描编排] 成功添加 ${folders.length} 个子文件夹到扫描队列`);
        } else {
            callbacks.logInfo(`[扫描编排] 目录 ${scanAction.path} 中没有发现子文件夹`);
        }

        return {
            shouldProcessSubfolders: true,
            shouldUpdateParentFolder: false,
            subfolders: folders,
        };
    } catch (error) {
        callbacks.logError(`[扫描编排] 扫描子文件夹失败: ${scanAction.path}`, error);
        return {
            shouldProcessSubfolders: false,
            shouldUpdateParentFolder: false,
        };
    }
}

/**
 * 异步纯函数：执行文件策略处理
 */
export async function executeFileStrategy(
    scanAction: ScanAction,
    callbacks: ScanCallbacks,
): Promise<ScanDecision> {
    callbacks.logInfo(`[扫描编排] 文件操作，更新父文件夹到树: ${scanAction.path}`);

    try {
        const parentDir = callbacks.extractParentDir(scanAction.path);

        if (parentDir && parentDir !== scanAction.path && parentDir !== "/") {
            callbacks.logInfo(`[扫描编排] 更新父文件夹到文件夹树: ${parentDir}`);
            callbacks.updateFolderTree(parentDir);

            return {
                shouldProcessSubfolders: false,
                shouldUpdateParentFolder: true,
                parentFolderPath: parentDir,
            };
        }
    } catch (error) {
        callbacks.logError(`[扫描编排] 更新父文件夹失败: ${scanAction.path}`, error);
    }

    return {
        shouldProcessSubfolders: false,
        shouldUpdateParentFolder: false,
    };
}

/**
 * 异步纯函数：执行扫描任务
 */
export async function executeScanTask(
    scanAction: ScanAction,
    callbacks: ScanCallbacks,
): Promise<ScanExecutionResult> {
    callbacks.logInfo(`[扫描编排] 开始执行文件扫描任务: ${scanAction.path}`);

    // 更新文件级别进度 - 显示正在处理的文件/目录的完整路径
    callbacks.updateFileProgress(scanAction.path);

    try {
        const result = await callbacks.performScanTask(scanAction);

        callbacks.logInfo(`[扫描编排] 文件扫描任务完成: ${scanAction.path}`);
        callbacks.logDebug(`[扫描编排] 扫描结果参数`, result);

        // 清理队列
        callbacks.completeScanPath(scanAction.path);

        // 更新文件夹树（如果需要）
        if (result?.action?.path && result?.action?.isDirectory) {
            callbacks.updateFolderTree(result.action.path);
        }

        return {
            success: true,
            shouldContinue: true,
        };
    } catch (error) {
        callbacks.logError(`[扫描编排] 扫描任务执行失败: ${scanAction.path}`, error as Error);
        callbacks.completeScanPath(scanAction.path);
        callbacks.updateProcessingStatus(
            callbacks.t("status.scanFailed", { path: scanAction.path }),
        );

        return {
            success: false,
            error: error as Error,
            shouldContinue: true, // 错误后继续处理下一个
        };
    }
}

// ============= 主编排函数 =============

/**
 * 纯函数：扫描编排器主函数
 *
 * 这个函数协调整个扫描流程，但不执行任何副作用
 * 所有副作用通过回调函数处理
 */
export async function orchestrateScan(
    scanQueue: ScanAction[],
    callbacks: ScanCallbacks,
): Promise<{
    processed: boolean;
    shouldScheduleNext: boolean;
    error?: Error;
}> {
    // 1. 获取下一个扫描项
    const nextItem = getNextScanItem(scanQueue);

    if (!nextItem) {
        callbacks.logDebug("[扫描编排] 队列为空，扫描完成");
        // 先发送扫描完成状态，然后延迟清理
        callbacks.updateProcessingStatus(callbacks.t("status.complete"));
        // 3秒后清理状态
        setTimeout(() => {
            callbacks.clearProcessingStatus();
        }, 3000);
        return { processed: false, shouldScheduleNext: false };
    }

    // 2. 验证扫描项
    const validation = validateScanAction(nextItem);
    if (!validation.isValid) {
        callbacks.logError(`[扫描编排] 扫描项验证失败: ${validation.error}`);
        return { processed: false, shouldScheduleNext: false };
    }

    // 3. 创建扫描副本并更新状态
    const scanAction = { ...nextItem, thumbnailSize: 150 }; // 可配置
    callbacks.updateProcessingStatus(callbacks.t("status.scanningPath", { path: scanAction.path }));

    callbacks.logInfo(
        `[扫描编排] 开始扫描: ${scanAction.path} ${scanAction.action} ${scanAction.operationType || "directory"}`,
    );

    // 4. 处理重扫描
    if (scanAction.action === "rescan" && scanAction.operationType === "directory") {
        // 仅对目录进行重置配置
        callbacks.logDebug(`[扫描编排] 重置配置: ${scanAction.path}`);
        await callbacks.resetPhotasaConfig(scanAction.path);
    }

    try {
        // 5. 根据操作类型执行策略
        const decision = decideScanStrategy(scanAction);

        if (decision.shouldUpdateParentFolder) {
            await executeFileStrategy(scanAction, callbacks);
        }

        if (decision.shouldProcessSubfolders) {
            await executeDirectoryStrategy(scanAction, callbacks);
        }

        // 6. 执行扫描任务
        const executionResult = await executeScanTask(scanAction, callbacks);

        return {
            processed: true,
            shouldScheduleNext: executionResult.shouldContinue,
            error: executionResult.error,
        };
    } catch (error) {
        callbacks.logError(`[扫描编排] 意外错误: ${scanAction.path}`, error as Error);
        callbacks.completeScanPath(scanAction.path);

        return {
            processed: true,
            shouldScheduleNext: true,
            error: error as Error,
        };
    }
}
