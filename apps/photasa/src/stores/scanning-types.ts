/**
 * 扫描队列 Store 内部类型定义（RFC 0048 v3）
 *
 * @description
 * 这些类型是Store内部使用的数据结构，包含v3状态机字段。
 * 与IPC契约（scan-types.ts中的ScanAction）分离，互不影响。
 *
 * @architecture
 * - ScanAction (scan-types.ts): IPC契约，renderer ↔ main通信
 * - ScanQueueItem (此文件): Store内部，包含状态机
 * - YuChiGong: 负责在两者之间转换
 *
 * @since RFC 0048 v3 - 状态机架构
 * @date 2025-11-23
 */

/**
 * 扫描队列项 - Store内部数据结构（v3状态机）
 *
 * 核心原则：
 * 1. Store 是唯一 SSOT - 所有任务状态以 Store 为准
 * 2. 状态机制 - pending → processing → [删除]
 * 3. 立即清理 - 成功完成立即删除，不保留 completed 状态
 * 4. 失败可重试 - failed 状态支持重试，达上限删除
 *
 * 状态转换规则：
 *
 * 1. 创建任务：
 *    → status: "pending", createdAt: now, retryCount: 0
 *
 * 2. 开始执行：
 *    pending → processing, startedAt: now
 *
 * 3. 执行成功：
 *    processing → [从 Store 删除]（不保留历史）
 *
 * 4. 执行失败：
 *    processing → failed, error: message, retryCount++
 *    if (retryCount < maxRetries):
 *        → 保留 failed 状态，等待重试
 *        → 重试时：failed → pending（重置状态）
 *    else:
 *        → [从 Store 删除]（达到重试上限）
 *
 * 5. 应用重启恢复：
 *    - pending 任务 → 恢复到 p-queue
 *    - processing 任务 → 重置为 pending（孤儿任务）
 *    - failed 任务：
 *        if (now - createdAt < 24h && retryCount < maxRetries):
 *            → 重置为 pending，重新尝试
 *        else:
 *            → [删除]（过期或超重试次数）
 */
export interface ScanQueueItem {
    /** 扫描路径 */
    path: string;

    /** 扫描动作类型 */
    action: "scan" | "rescan" | "current";

    /**
     * 任务状态（状态机）
     * - pending: 等待执行
     * - processing: 正在执行
     * - failed: 执行失败（可重试）
     * - 注意：无 completed 状态，成功即删除
     */
    status: "pending" | "processing" | "failed";

    /** 任务创建时间戳 */
    createdAt: number;

    /** 任务开始执行时间戳（processing 时设置） */
    startedAt?: number;

    /** 任务来源 */
    source: "user" | "auto" | "discovered";

    /** 错误信息（failed 时设置） */
    error?: string;

    /** 重试次数（failed 时递增） */
    retryCount: number;

    /** 最大重试次数 */
    maxRetries: number;

    /** 任务优先级（数值越小越优先） */
    priority?: number;

    /** 原始文件操作 ID */
    fileOperationId?: string;

    /** 操作类型 */
    operationType: "directory" | "file";

    /** 缩略图大小 */
    thumbnailSize: number;

    /**
     * 扫描进度（运行时状态）
     * @note 这是运行时状态，不持久化到存储
     * @todo Phase 2: 重构为独立的运行时状态管理
     */
    progress?: {
        processed: number;
        total: number;
        cacheEnabled?: boolean;
    };
}

/**
 * 扫描队列项创建选项
 *
 * @description
 * 用于从ScanAction（IPC契约）创建ScanQueueItem（Store内部）的辅助类型
 */
export interface ScanQueueItemCreateOptions {
    /** 扫描路径 */
    path: string;

    /** 扫描动作类型 */
    action: "scan" | "rescan" | "current";

    /** 任务来源（默认 "user"） */
    source?: "user" | "auto" | "discovered";

    /** 操作类型（默认 "directory"） */
    operationType?: "directory" | "file";

    /** 缩略图大小（默认 150） */
    thumbnailSize?: number;

    /** 最大重试次数（默认 3） */
    maxRetries?: number;

    /** 任务优先级 */
    priority?: number;

    /** 原始文件操作 ID */
    fileOperationId?: string;
}

/**
 * 从IPC ScanAction创建Store ScanQueueItem
 *
 * @param options - 创建选项
 * @returns Store内部的ScanQueueItem对象
 *
 * @example
 * ```typescript
 * // 从IPC接收的ScanAction
 * const scanAction: ScanAction = { path: "/test", action: "scan", thumbnailSize: 150 };
 *
 * // 转换为Store内部的ScanQueueItem
 * const queueItem = createScanQueueItem({
 *     path: scanAction.path,
 *     action: scanAction.action,
 *     thumbnailSize: scanAction.thumbnailSize,
 *     source: "user"
 * });
 * ```
 */
export function createScanQueueItem(options: ScanQueueItemCreateOptions): ScanQueueItem {
    return {
        path: options.path,
        action: options.action,
        status: "pending",
        createdAt: Date.now(),
        source: options.source || "user",
        retryCount: 0,
        maxRetries: options.maxRetries || 3,
        priority: options.priority,
        fileOperationId: options.fileOperationId,
        operationType: options.operationType || "directory",
        thumbnailSize: options.thumbnailSize || 150,
    };
}

/**
 * 从Store ScanQueueItem转换为IPC ScanAction
 *
 * @param queueItem - Store内部的ScanQueueItem
 * @returns IPC契约的ScanAction对象
 *
 * @example
 * ```typescript
 * // Store内部的ScanQueueItem
 * const queueItem: ScanQueueItem = { ... };
 *
 * // 转换为IPC ScanAction（发送给main进程）
 * const scanAction = toScanAction(queueItem);
 * ```
 */
export function toScanAction(queueItem: ScanQueueItem) {
    return {
        path: queueItem.path,
        action: queueItem.action,
        thumbnailSize: queueItem.thumbnailSize,
        operationType: queueItem.operationType,
        source: queueItem.source,
        timestamp: queueItem.createdAt,
        retryCount: queueItem.retryCount,
        priority: queueItem.priority,
        fileOperationId: queueItem.fileOperationId,
    };
}
