import PQueue from "p-queue";
import { IService } from "@/interfaces/service.interface";
import { IYuChiGongService } from "@renderer/interfaces/yu-chi-gong.interface";
import type { Shengzhi } from "@renderer/interfaces/shengzhi.interface";
import type { Qizou } from "@renderer/interfaces/qizou.interface";
import type { Emitter } from "mitt";
import { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import {
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
    GUANYUAN_NAMES,
    type Zouzhe,
} from "@renderer/interfaces/fang-xuan-ling.interface";
// ✅ RFC 0048 v3 Phase 4: QizouMatters 导入已删除（随persistToStore()一起删除）
import { ShengzhiCommands } from "@renderer/constants/qizou-shengzhi-commands";
import type { FileOperation, ScanAction } from "@photasa/common";
import type { ScanQueueItem } from "@renderer/stores/scanning-types";
import { loggers, mapFileOperationToScanAction } from "@photasa/common";
import { normalizePath } from "@renderer/utils/path";
import {
    calculateTaskAge,
    calculateHoursAgo,
    getFailedTaskAction,
    calculateNextRetryCount,
    getTaskStatusDisplayText,
} from "./task-helpers";
import {
    SCAN_QUEUE_DISCOVERED_BATCH_MS,
    SCAN_QUEUE_RESTORE_FROM_DISK,
} from "@renderer/services/yuantiangang/scan-queue-contract";

// ✅ RFC 0042 Step 2.5: folderTree管理已迁移到魏征服务，不再需要folder-tree相关导入

const logger = loggers.yuchigong;

/**
 * 尉迟恭（YuChiGong）- 扫描队列业务协调官
 *
 * 职责：
 * 1. 接收李世民圣旨（add_scan_task / remove_scan_task）
 * 2. 主动控制扫描任务执行（使用 p-queue）
 * 3. 创建ScanAction对象并发送ADD_SCAN_ACTION奏折给房玄龄（用于持久化）
 * 4. 通过qizou启奏向李世民汇报任务结果
 *
 * **架构原则**（2025-01-16 重构）：
 * - ✅ 服务主动控制执行 - 使用 p-queue 管理扫描任务执行
 * - ✅ 不依赖 Store 触发 - 执行队列（p-queue）独立于持久化队列（Store）
 * - ✅ 持久化仅用于恢复 - Store 只用于应用重启后恢复未完成任务
 * - ✅ 无响应式监听 - 不使用 watchArray，纯业务逻辑控制
 *
 * **执行流程**：
 * 1. addScanTasks() → 添加到 p-queue（执行） + 发奏折（持久化）
 * 2. p-queue 自动按序执行任务
 * 3. executeScan() 执行单个扫描任务
 * 4. 扫描完成后从持久化队列移除
 *
 * @class YuChiGongService
 * @implements {IService}
 * @since RFC 0038 Phase 7 - qizou-shengzhi架构
 * @updated 2025-01-16 - 使用 p-queue 替代 watchArray，服务主动控制执行
 */
export class YuChiGongService implements IService, IYuChiGongService {
    /**
     * 启奏事件总线
     * 用于向李世民发送qizou启奏
     */
    private _qizouBus: Emitter<{ qizou: Qizou }> | null = null;

    /**
     * 扫描执行队列
     * 使用 p-queue 确保任务按序执行，同时只运行一个扫描任务
     */
    private scanQueue: PQueue;

    /** RFC 0162：scan_directory_discovered 批量入队 */
    private pendingDiscoveredScans: ScanAction[] = [];
    private discoveredScanFlushTimer: ReturnType<typeof setTimeout> | null = null;
    private discoveredScanFlushChain: Promise<void> = Promise.resolve();

    constructor(private fangXuanLingService: IFangXuanLingService) {
        logger.info("🛡️ 尉迟恭就任，负责扫描队列业务逻辑管理");

        // 初始化执行队列：concurrency: 1 确保同时只执行一个扫描任务
        this.scanQueue = new PQueue({ concurrency: 1 });

        // ✅ 添加错误监听器，防止未捕获错误导致队列停止
        this.scanQueue.on("error", (error) => {
            logger.error("🛡️ 尉迟恭：扫描队列发生未捕获错误", error);
        });

        // ✅ RFC 0057: 监听队列空闲事件，当队列为空时通知 yuShiNan 清空状态
        this.scanQueue.on("idle", () => {
            // 检查持久化队列是否也为空
            const persistentQueueSize = this.fangXuanLingService.scanning.queueSize;
            if (persistentQueueSize === 0) {
                logger.info("🛡️ 尉迟恭：扫描队列已完全清空，通知虞世南清空状态");
                // ✅ 发送 qizou 通知 yuShiNan 清空扫描状态
                this.emitQizou("scan_queue_empty", {});
            }
        });

        logger.info("🛡️ 尉迟恭：扫描执行队列已就绪");
    }

    /**
     * 执行单个扫描任务（核心扫描逻辑）
     *
     * @description
     * 扫描编排7步流程：
     * 1. 启奏开始
     * 2. 重扫描时重置配置
     * 3. 文件操作 - 记录父目录
     * 4. 目录操作 - 扫描子文件夹（递归添加到队列）
     * 5. 执行扫描
     * 6. 移除任务（从持久化队列）
     * 7. 启奏完成/失败
     *
     * @param path 扫描路径
     * @param action 扫描动作类型
     * @param operationType 操作类型（文件或目录）
     *
     * @private
     * @since 2025-01-16 重构
     */
    private async executeScan(
        path: string,
        action: "scan" | "rescan" | "current",
        operationType: "directory" | "file" = "directory",
        thumbnailSize = 150,
    ): Promise<void> {
        logger.info(`🛡️ 尉迟恭：开始扫描 ${path}`);

        // 1. ✅ RFC 0048 v3: pending → processing
        await this.updateTaskStatus(path, "processing", { startedAt: Date.now() });

        // 2. 启奏开始
        this.emitQizou("scan_started", { path });

        try {
            // 3. 重扫描时重置配置
            if (action === "rescan" && operationType === "directory") {
                await this.fangXuanLingService.processZouzhe({
                    department: GUANYUAN_NAMES.YU_CHI_GONG,
                    matter: ZOUZHE_MATTERS.RESET_FOLDER_CONFIG,
                    content: { folder: path },
                    timestamp: Date.now(),
                    priority: ZOUZHE_PRIORITIES.NORMAL,
                });
            }

            // 4. 文件操作 - 记录父目录
            let parentDir: string | null = null;
            if (operationType === "file") {
                const res = await this.fangXuanLingService.processZouzhe({
                    department: GUANYUAN_NAMES.YU_CHI_GONG,
                    matter: ZOUZHE_MATTERS.TO_DIR_NAME,
                    content: { path },
                    timestamp: Date.now(),
                    priority: ZOUZHE_PRIORITIES.NORMAL,
                });
                parentDir = typeof res.data === "string" ? res.data : null;
            }

            // 5. 执行扫描（子目录发现由千里眼 ScanDirectoryReport → scan_directory_discovered，RFC 0136）
            await this.fangXuanLingService.processZouzhe({
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.SCAN_PHOTOS,
                content: {
                    path,
                    action,
                    thumbnailSize,
                    isDirectory: operationType !== "file",
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            });

            // 6. ✅ RFC 0048 v3: 完成即删除（无completed状态）
            await this.deleteTask(path);

            // 7. 启奏完成
            this.emitQizou("scan_completed", {
                path,
                parentDir,
                operationType,
            });

            logger.info(`🛡️ 尉迟恭：扫描完成并清理 ${path}`);
        } catch (error) {
            logger.error(`🛡️ 尉迟恭：扫描失败 ${path}`, error);

            // ✅ RFC 0048 v3: 失败时更新为failed状态（支持重试）
            try {
                await this.updateTaskStatus(path, "failed", {
                    error: String(error),
                    retryCount: 0, // TODO: Phase 3 - 从Store读取当前retryCount并递增
                });
            } catch (statusError) {
                logger.error(`🛡️ 尉迟恭：更新失败状态错误 ${path}`, statusError);
            }

            this.emitQizou("scan_failed", { path, error: String(error) });
        }
    }

    /**
     * 更新任务状态（RFC 0048 v3 状态机核心）
     *
     * @description
     * 状态转换规则：
     * - pending → processing: 任务开始执行
     * - processing → failed: 任务执行失败（可重试）
     * - processing → [删除]: 任务执行成功（立即清理）
     *
     * @param path 任务路径
     * @param status 目标状态
     * @param updates 额外更新字段（error, startedAt等）
     * @private
     * @since RFC 0048 Phase 2
     */
    private async updateTaskStatus(
        path: string,
        status: "pending" | "processing" | "failed",
        updates: Partial<ScanQueueItem> = {},
    ): Promise<void> {
        logger.debug(`🛡️ 尉迟恭：更新任务状态 ${path} → ${status}`, updates);

        // ✅ RFC 0048 v3 Phase 3: 通过Zouzhe更新Store状态
        const updateZouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.YU_CHI_GONG,
            matter: ZOUZHE_MATTERS.UPDATE_SCAN_ACTION_STATUS,
            content: { path, status, updates },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.URGENT, // 状态更新是紧急操作
        };

        const response = await this.fangXuanLingService.processZouzhe(updateZouzhe);

        if (!response.approved) {
            logger.error(`🛡️ 尉迟恭：状态更新失败 ${path} - ${response.instruction}`);
            throw new Error(`房玄龄状态更新失败：${response.instruction}`);
        }

        logger.debug(`🛡️ 尉迟恭：状态更新成功 ${path} → ${status}`);
    }

    /**
     * 批量创建pending任务到Store（RFC 0048 v3 子文件夹持久化）
     *
     * @description
     * 用于子文件夹扫描时，将发现的子文件夹批量持久化到Store
     * 所有任务初始状态为pending，等待p-queue调度执行
     *
     * @param scanActions IPC层的ScanAction数组
     * @private
     * @since RFC 0048 Phase 2
     */
    private async createTasks(scanActions: ScanAction[]): Promise<void> {
        if (scanActions.length === 0) return;

        logger.info(`🛡️ 尉迟恭：批量创建pending任务 ${scanActions.length}个`);

        const addActionsZouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.YU_CHI_GONG,
            matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
            content: { actions: scanActions }, // 工作流期望IPC类型
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        const response = await this.fangXuanLingService.processZouzhe(addActionsZouzhe);

        if (!response.approved) {
            throw new Error(`房玄龄批量创建任务失败：${response.instruction}`);
        }

        logger.info(`🛡️ 尉迟恭：批量创建任务成功 ${scanActions.length}个`);
    }

    /**
     * 获取当前缩略图大小
     */
    private getCurrentThumbnailSize(): number {
        const size = this.fangXuanLingService.preference.thumbnailSize;
        return Number.isFinite(size) && size > 0 ? size : 150;
    }

    /**
     * 持久化并入队单个扫描任务（Store + p-queue）
     */
    private async scheduleScanAction(scanAction: ScanAction): Promise<void> {
        await this.createTasks([scanAction]);

        const operationType = scanAction.operationType || "directory";
        logger.info(`🛡️ 尉迟恭：添加任务到执行队列 ${scanAction.path} (${scanAction.action})`);
        this.scanQueue
            .add(() =>
                this.executeScan(
                    scanAction.path,
                    scanAction.action,
                    operationType,
                    scanAction.thumbnailSize,
                ),
            )
            .catch((error) => {
                logger.error(`🛡️ 尉迟恭：任务执行失败 ${scanAction.path}`, error);
            });
    }

    /**
     * 持久化并入队单个目录扫描任务（Store + p-queue）
     */
    private async scheduleDirectoryScan(
        path: string,
        action: "scan" | "rescan" | "current",
        source: "user" | "auto",
    ): Promise<void> {
        const scanAction: ScanAction = {
            path,
            action,
            thumbnailSize: this.getCurrentThumbnailSize(),
            source,
            timestamp: Date.now(),
            operationType: "directory",
        };

        if (source === "auto") {
            this.enqueueDiscoveredScan(scanAction);
            return;
        }

        await this.scheduleScanAction(scanAction);
    }

    /** RFC 0162：合并 discovered 风暴为单批 createTasks */
    private enqueueDiscoveredScan(scanAction: ScanAction): void {
        this.pendingDiscoveredScans.push(scanAction);
        if (this.discoveredScanFlushTimer) {
            return;
        }
        this.discoveredScanFlushTimer = setTimeout(() => {
            this.discoveredScanFlushTimer = null;
            this.discoveredScanFlushChain = this.discoveredScanFlushChain
                .then(() => this.flushDiscoveredScans())
                .catch((error) => {
                    logger.error("🛡️ 尉迟恭：批量发现入队失败", error);
                });
        }, SCAN_QUEUE_DISCOVERED_BATCH_MS);
    }

    private async flushDiscoveredScans(): Promise<void> {
        const batch = this.pendingDiscoveredScans.splice(0);
        if (batch.length === 0) {
            return;
        }

        logger.info(`🛡️ 尉迟恭：批量发现入队 ${batch.length} 个目录`);
        await this.createTasks(batch);

        for (const scanAction of batch) {
            const operationType = scanAction.operationType || "directory";
            logger.info(`🛡️ 尉迟恭：添加任务到执行队列 ${scanAction.path} (${scanAction.action})`);
            this.scanQueue
                .add(() =>
                    this.executeScan(
                        scanAction.path,
                        scanAction.action,
                        operationType,
                        scanAction.thumbnailSize,
                    ),
                )
                .catch((error) => {
                    logger.error(`🛡️ 尉迟恭：任务执行失败 ${scanAction.path}`, error);
                });
        }
    }

    /**
     * 删除任务（RFC 0048 v3 立即清理）
     *
     * @description
     * 任务完成后立即从Store删除，不保留completed状态
     * 符合"Store = SSOT + 零历史"原则
     *
     * @param path 任务路径
     * @private
     * @since RFC 0048 Phase 2
     */
    private async deleteTask(path: string): Promise<void> {
        logger.debug(`🛡️ 尉迟恭：删除任务 ${path}`);

        // 通过Zouzhe删除Store任务
        const removeZouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.YU_CHI_GONG,
            matter: ZOUZHE_MATTERS.REMOVE_SCAN_ACTION,
            content: { path },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        const response = await this.fangXuanLingService.processZouzhe(removeZouzhe);

        if (!response.approved) {
            logger.error(`🛡️ 尉迟恭：删除任务失败 ${path} - ${response.instruction}`);
            throw new Error(`房玄龄删除任务失败：${response.instruction}`);
        }

        logger.debug(`🛡️ 尉迟恭：任务已删除 ${path}`);
    }

    /**
     * IService接口实现 - 服务名称标识
     */
    get name(): string {
        return "尉迟恭";
    }
    // ✅ RFC 0042 Step 2.5: folderTree管理已迁移到魏征服务

    /**
     * IService接口实现 - 设置圣旨接收通道（单向）
     * @param port MessageChannel的port2端，用于接收圣旨
     */
    setShengzhiPort(port: MessagePort): void {
        logger.info("🛡️ 尉迟恭建立圣旨接收通道");

        // 监听圣旨
        port.onmessage = async (event: MessageEvent): Promise<void> => {
            const shengzhi: Shengzhi = event.data;
            logger.info(`🛡️ 尉迟恭奉旨: ${shengzhi.command} [圣旨ID: ${shengzhi.id}]`);
            logger.debug("🛡️ 尉迟恭奉旨详情:", shengzhi);

            // 处理圣旨
            await this.processShengzhi(shengzhi);
        };
    }

    /**
     * 设置启奏事件总线
     * @param qizouBus mitt事件总线，用于发送qizou启奏
     */
    setQizouBus(qizouBus: Emitter<{ qizou: Qizou }>): void {
        logger.info("🛡️ 尉迟恭建立启奏通道");
        this._qizouBus = qizouBus;
    }

    /**
     * 处理圣旨（核心状态机）
     *
     * @param shengzhi 圣旨内容
     *
     * @description
     * 状态转换图：
     * ```
     *        收到圣旨
     *           ↓
     *    ┌─────────────┐
     *    │ 解析command │
     *    └─────────────┘
     *           ↓
     *    ┌──────┴──────┐
     *    │             │
     * add_scan    remove_scan
     *    │             │
     *    ↓             ↓
     * 添加队列      移除队列
     *    │             │
     *    ↓             ↓
     * 发送奏折      发送奏折
     *    │             │
     *    ↓             ↓
     * 启奏成功      启奏完成
     * ```
     *
     * 错误处理策略：
     * - 参数验证失败 → 启奏失败 → 记录日志
     * - 奏折发送失败 → 回滚状态 → 启奏失败
     * - 未知命令 → 启奏未知 → 记录警告
     */
    private async processShengzhi(shengzhi: Shengzhi): Promise<void> {
        try {
            switch (shengzhi.command) {
                case "add_scan_task":
                    await this.handleAddScanTask(shengzhi);
                    break;
                case "remove_scan_task":
                    await this.handleRemoveScanTask(shengzhi);
                    break;
                case "cleanup_scan_queue_for_path":
                    await this.handleCleanupScanQueueForPath(shengzhi);
                    break;
                case ShengzhiCommands.SCHEDULE_WATCH_FILE_OPERATIONS:
                    await this.handleScheduleWatchFileOperations(shengzhi);
                    break;
                // ✅ RFC 0042 Step 2.5: update_folder_tree已迁移到魏征服务
                default:
                    logger.warn(`🛡️ 尉迟恭收到未知圣旨命令: ${shengzhi.command}`);
                    this.emitQizou("shengzhi_unknown", {
                        shengzhiId: shengzhi.id,
                        command: shengzhi.command,
                        error: "未知圣旨命令",
                    });
            }
        } catch (error) {
            logger.error("🛡️ 尉迟恭执行圣旨失败:", error);
            this.emitQizou("shengzhi_failed", {
                shengzhiId: shengzhi.id,
                command: shengzhi.command,
                error: String(error),
            });
        }
    }

    /**
     * 处理添加扫描任务圣旨
     * @param shengzhi 圣旨内容
     */
    private async handleAddScanTask(shengzhi: Shengzhi): Promise<void> {
        const content = (shengzhi.content ?? {}) as Record<string, unknown>;
        const rawPath = content.path;

        // 拒绝非字符串（含 Promise：曾因 async normalizePath 进 content，stringify 后 path 消失）
        if (typeof rawPath !== "string" || rawPath.trim() === "") {
            logger.error("🛡️ 尉迟恭：圣旨缺少path参数或类型错误", {
                shengzhiId: shengzhi.id,
                pathType: rawPath === null ? "null" : typeof rawPath,
                contentKeys: Object.keys(content),
            });
            this.emitQizou("scan_task_failed", {
                shengzhiId: shengzhi.id,
                error: "缺少path参数或类型错误",
            });
            return;
        }

        const normalizedPath = normalizePath(rawPath.trim());
        logger.info(`🛡️ 尉迟恭接旨：添加扫描任务 ${normalizedPath}`);

        try {
            const action = (content.action as "scan" | "rescan" | "current") || "scan";
            const source =
                content.source === "discovered"
                    ? "auto"
                    : (content.source as "user" | "auto") || "user";

            // scan 去重；rescan 先 REMOVE 再 ADD（对齐 watch 路径，避免 Rust add_actions 静默跳过）
            if (this.fangXuanLingService.scanning.isInQueue(normalizedPath)) {
                if (action === "rescan") {
                    await this.removeScanTask(normalizedPath, { force: true });
                } else {
                    logger.warn(`🛡️ 尉迟恭：扫描任务已存在，去重跳过添加 ${normalizedPath}`);
                    this.emitQizou("scan_task_duplicate", {
                        shengzhiId: shengzhi.id,
                        path: normalizedPath,
                    });
                    return;
                }
            } else if (action === "rescan") {
                // Pinia 空但 scanning.json 可能仍有条目
                await this.removeScanTask(normalizedPath, { force: true });
            }

            await this.scheduleDirectoryScan(normalizedPath, action, source);

            logger.info(`🛡️ 尉迟恭：扫描任务已添加并开始执行（响应圣旨） ${normalizedPath}`);
        } catch (error) {
            logger.error(`🛡️ 尉迟恭：添加扫描任务失败 ${normalizedPath}`, error);

            // 向李世民启奏汇报失败
            this.emitQizou("scan_task_failed", {
                shengzhiId: shengzhi.id,
                path: normalizedPath,
                error: String(error),
            });

            throw error;
        }
    }

    /**
     * ✅ RFC 0137: 处理文件监视合并批次圣旨（原 App.vue onScanQueueAdd）
     */
    private async handleScheduleWatchFileOperations(shengzhi: Shengzhi): Promise<void> {
        const content = (shengzhi.content ?? {}) as Record<string, unknown>;
        const operations = content.operations;

        if (!Array.isArray(operations) || operations.length === 0) {
            logger.debug("🛡️ 尉迟恭：watch 批次为空，跳过");
            return;
        }

        const thumbnailSize = this.fangXuanLingService.preference.thumbnailSize;
        await this.scheduleFileOperationsFromWatch(operations as FileOperation[], thumbnailSize);
    }

    /**
     * 处理清理扫描队列圣旨（移除监控文件夹时）
     * ✅ Bug修复：当移除监控文件夹时，需要清理该路径及其所有子目录的未扫描任务
     *
     * @param shengzhi 圣旨内容，包含要清理的路径
     */
    private async handleCleanupScanQueueForPath(shengzhi: Shengzhi): Promise<void> {
        const content = shengzhi.content as Record<string, unknown>;
        const path = content.path as string;

        // 路径参数验证
        if (!path || typeof path !== "string") {
            logger.error("🛡️ 尉迟恭：圣旨缺少path参数或类型错误");
            return;
        }

        // 路径安全验证：不能为空字符串
        if (path.trim() === "") {
            logger.error("🛡️ 尉迟恭：圣旨path为空字符串");
            return;
        }

        const normalizedPathToRemove = normalizePath(path);
        logger.info(`🛡️ 尉迟恭接旨：清理扫描队列 ${normalizedPathToRemove}（包括所有子目录）`);

        try {
            // 找出所有需要移除的路径（包括子目录）
            const queue = this.fangXuanLingService.scanning.queue;
            const pathsToRemove: string[] = [];

            // 遍历队列，找出所有需要移除的路径
            for (const action of queue) {
                const itemPath = normalizePath(action.path);

                // 如果路径是要移除的路径本身，或者是其子目录，则标记为需要移除
                if (normalizedPathToRemove === "/") {
                    // 如果移除的是根路径，移除所有项
                    pathsToRemove.push(itemPath);
                } else {
                    const isExactMatch = itemPath === normalizedPathToRemove;
                    const isSubdirectory = itemPath.startsWith(normalizedPathToRemove + "/");
                    if (isExactMatch || isSubdirectory) {
                        pathsToRemove.push(itemPath);
                    }
                }
            }

            if (pathsToRemove.length === 0) {
                logger.info(`🛡️ 尉迟恭：扫描队列中无相关任务需要清理 ${normalizedPathToRemove}`);
                return;
            }

            logger.info(
                `🛡️ 尉迟恭：发现 ${pathsToRemove.length} 个相关扫描任务需要清理（包括子目录）`,
            );

            // 批量移除扫描任务（逐个发送REMOVE_SCAN_ACTION奏折，因为工作流只支持单个路径）
            let successCount = 0;
            let failedCount = 0;
            const errors: string[] = [];

            for (const pathToRemoveFromQueue of pathsToRemove) {
                try {
                    // ✅ RFC 0042要求：只发送REMOVE_SCAN_ACTION奏折
                    // 房玄龄负责更新Store并触发天界持久化
                    const removeActionZouzhe: Zouzhe = {
                        department: GUANYUAN_NAMES.YU_CHI_GONG,
                        matter: ZOUZHE_MATTERS.REMOVE_SCAN_ACTION,
                        content: { path: pathToRemoveFromQueue },
                        timestamp: Date.now(),
                        priority: ZOUZHE_PRIORITIES.NORMAL,
                    };

                    logger.debug(`🛡️ 尉迟恭向房玄龄呈递移除扫描任务奏折: ${pathToRemoveFromQueue}`);
                    const response =
                        await this.fangXuanLingService.processZouzhe(removeActionZouzhe);

                    if (!response.approved) {
                        throw new Error(`房玄龄未批准：${response.instruction}`);
                    }

                    successCount++;
                } catch (error) {
                    failedCount++;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    errors.push(`${pathToRemoveFromQueue}: ${errorMsg}`);
                    logger.warn(`🛡️ 尉迟恭：移除扫描任务失败 ${pathToRemoveFromQueue}:`, error);
                    // 继续处理其他任务，不中断流程
                }
            }

            // ✅ Validator要求：向李世民启奏汇报队列清理完成
            if (failedCount > 0) {
                logger.warn(
                    `🛡️ 尉迟恭：清理扫描队列部分失败，成功 ${successCount} 个，失败 ${failedCount} 个`,
                    { errors },
                );
            } else {
                logger.info(`🛡️ 尉迟恭：成功清理 ${successCount} 个扫描任务（包括子目录）`);
            }
        } catch (error) {
            logger.error(`🛡️ 尉迟恭：清理扫描队列失败 ${normalizedPathToRemove}`, error);

            throw error;
        }
    }

    /**
     * 处理移除扫描任务圣旨（扫描完成后移除单个任务）
     * @param shengzhi 圣旨内容
     */
    private async handleRemoveScanTask(shengzhi: Shengzhi): Promise<void> {
        const content = shengzhi.content as Record<string, unknown>;
        const path = content.path as string;

        // 路径参数验证
        if (!path || typeof path !== "string") {
            logger.error("🛡️ 尉迟恭：圣旨缺少path参数或类型错误");
            this.emitQizou("scan_task_failed", {
                shengzhiId: shengzhi.id,
                error: "缺少path参数或类型错误",
            });
            return;
        }

        // 路径安全验证：不能为空字符串
        if (path.trim() === "") {
            logger.error("🛡️ 尉迟恭：圣旨path为空字符串");
            this.emitQizou("scan_task_failed", {
                shengzhiId: shengzhi.id,
                error: "path为空字符串",
            });
            return;
        }

        logger.info(`🛡️ 尉迟恭接旨：移除扫描任务 ${path}`);

        try {
            // 1. ✅ Validator要求：使用Accessor检查，不维护本地Set
            if (!this.fangXuanLingService.scanning.isInQueue(path)) {
                logger.warn(`🛡️ 尉迟恭：队列中未找到任务 ${path}，但仍通知房玄龄`);
            }

            // 2. ✅ RFC 0042要求：只发送REMOVE_SCAN_ACTION奏折
            // 房玄龄负责更新Store并触发天界持久化
            const removeActionZouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.REMOVE_SCAN_ACTION,
                content: { path },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info(`🛡️ 尉迟恭向房玄龄呈递移除扫描任务奏折: ${path}`);
            const response = await this.fangXuanLingService.processZouzhe(removeActionZouzhe);

            if (!response.approved) {
                throw new Error(`房玄龄未批准：${response.instruction}`);
            }

            // 3. ✅ Validator要求：向李世民启奏汇报任务已移除
            this.emitQizou("scan_task_removed", {
                shengzhiId: shengzhi.id,
                path,
                persisted: (response.data as Record<string, unknown>)?.persisted === true,
            });

            logger.info(`🛡️ 尉迟恭：扫描任务已移除 ${path}`);
        } catch (error) {
            logger.error(`🛡️ 尉迟恭：移除扫描任务失败 ${path}`, error);

            // 向李世民启奏汇报失败
            this.emitQizou("scan_task_failed", {
                shengzhiId: shengzhi.id,
                path,
                error: String(error),
            });

            throw error;
        }
    }

    /**
     * 向李世民启奏（通过mitt事件总线）
     *
     * @param matter 启奏事项
     * @param content 启奏内容
     * @param type 启奏类型（request=请求批准, report=汇报完成）
     *
     * @description
     * 启奏流程：
     * ```
     * 尉迟恭任务完成
     *       ↓
     * 构建Qizou对象
     *       ↓
     * mitt.emit('qizou')
     *       ↓
     * 李世民路由器监听
     *       ↓
     * 根据matter路由决策
     * ```
     *
     * @example
     * ```typescript
     * // 扫描任务启动后汇报
     * this.emitQizou("scan_task_started", {
     *   shengzhiId: "shengzhi-001",
     *   path: "/photos",
     *   queueSize: 3
     * }, "report");
     * ```
     */
    private emitQizou(
        matter: string,
        content: Record<string, unknown>,
        type: "request" | "report" = "report",
    ): void {
        if (!this._qizouBus) {
            logger.error("🛡️ 尉迟恭无法启奏：启奏通道未建立");
            return;
        }

        const qizou: Qizou = {
            matter,
            content,
            from: "尉迟恭",
            timestamp: Date.now(),
            metadata: { type },
        };

        logger.info(`🛡️ 尉迟恭启奏: ${matter} (${type})`);
        logger.debug("🛡️ 尉迟恭启奏详情:", qizou);

        this._qizouBus.emit("qizou", qizou);
    }

    /**
     * 扫描队列（只读属性，v3: 返回 ScanQueueItem[] 包含状态机）
     * UI层可以直接访问任务状态（pending/processing/failed）
     * 委托到房玄龄的ScanningStore Accessor
     */
    get scanningQueue(): ScanQueueItem[] {
        return this.fangXuanLingService.scanning.queue;
    }

    /**
     * 扫描队列长度（只读属性）
     * 委托到房玄龄的ScanningStore Accessor
     */
    get queueSize(): number {
        return this.fangXuanLingService.scanning.queueSize;
    }

    /**
     * 检查路径是否在扫描队列中
     * 委托到房玄龄的ScanningStore Accessor
     * @param path 路径
     * @returns 是否在队列中
     */
    isInQueue(path: string): boolean {
        return this.fangXuanLingService.scanning.isInQueue(path);
    }

    // ✅ RFC 0048 v3 Phase 4: addScanTask(), addScanTasks() 和 persistToStore() 已删除
    // 原因：违反 "Store as SSOT" 原则，绕过了 Qizou-Shengzhi-FangXuanLing 标准流程
    // 替代方案：所有扫描任务添加必须通过李世民圣旨系统触发

    async removeScanTask(path: string, options?: { force?: boolean }): Promise<void> {
        // 路径参数验证
        if (!path || typeof path !== "string") {
            throw new Error("路径参数无效：必须是非空字符串");
        }

        // 路径安全验证
        if (path.trim() === "") {
            throw new Error("路径不能为空字符串");
        }

        logger.info(`🛡️ 尉迟恭：移除扫描任务 ${path}`);

        try {
            // rescan 须强制落盘移除：Pinia 可能与 scanning.json 不同步
            if (!options?.force && !this.fangXuanLingService.scanning.isInQueue(path)) {
                logger.warn(`🛡️ 尉迟恭：路径不在队列中，静默返回: ${path}`);
                return;
            }

            // 发送REMOVE_SCAN_ACTION奏折
            const removeActionZouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.REMOVE_SCAN_ACTION,
                content: { path },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info(`🛡️ 尉迟恭向房玄龄呈递移除扫描任务奏折: ${path}`);
            const response = await this.fangXuanLingService.processZouzhe(removeActionZouzhe);

            if (!response.approved) {
                throw new Error(`房玄龄未批准：${response.instruction}`);
            }

            logger.info(`🛡️ 尉迟恭：扫描任务已移除 ${path}`);
        } catch (error) {
            logger.error(`🛡️ 尉迟恭：移除扫描任务失败 ${path}`, error);
            throw error;
        }
    }

    /**
     * 用户从文件夹树触发的重新扫描
     */
    async requestRescan(path: string): Promise<void> {
        const normalizedPath = normalizePath(path);

        if (!normalizedPath || normalizedPath.trim() === "") {
            throw new Error("路径不能为空字符串");
        }

        logger.info(`🛡️ 尉迟恭：用户请求重新扫描 ${normalizedPath}`);

        // 强制 REMOVE 再入队，避免磁盘去重导致 rescan 不落盘
        await this.removeScanTask(normalizedPath, { force: true });

        await this.scheduleDirectoryScan(normalizedPath, "rescan", "user");
    }

    /**
     * 文件监视服务批量事件入扫描执行队列（单次持久化批次，避免 N 次 IPC 写盘）
     */
    async scheduleFileOperationsFromWatch(
        operations: FileOperation[],
        thumbnailSize: number,
    ): Promise<void> {
        const pending: ScanAction[] = [];

        for (const operation of operations) {
            const normalizedPath = normalizePath(operation.path);
            if (!normalizedPath || normalizedPath.trim() === "") {
                logger.warn("🛡️ 尉迟恭：跳过空 watch 扫描路径", operation);
                continue;
            }

            const action = mapFileOperationToScanAction(operation.type);
            if (this.fangXuanLingService.scanning.isInQueue(normalizedPath)) {
                if (action !== "rescan") {
                    logger.warn(`🛡️ 尉迟恭：watch 扫描任务已存在，跳过 ${normalizedPath}`);
                    continue;
                }
                await this.removeScanTask(normalizedPath, { force: true });
            }

            pending.push({
                path: normalizedPath,
                action,
                thumbnailSize: operation.metadata?.thumbnailSize || thumbnailSize,
                source: "auto",
                timestamp: operation.timestamp,
                operationType: operation.metadata?.isFile ? "file" : "directory",
                retryCount: operation.retryCount,
                fileOperationId: operation.id,
                priority: operation.priority,
            });
        }

        if (pending.length === 0) {
            return;
        }

        await this.createTasks(pending);

        for (const scanAction of pending) {
            logger.info(`🛡️ 尉迟恭：添加任务到执行队列 ${scanAction.path} (${scanAction.action})`);
            this.scanQueue
                .add(() =>
                    this.executeScan(
                        scanAction.path,
                        scanAction.action,
                        scanAction.operationType,
                        scanAction.thumbnailSize,
                    ),
                )
                .catch((error) => {
                    logger.error(`🛡️ 尉迟恭：任务执行失败 ${scanAction.path}`, error);
                });
        }
    }

    /**
     * ✅ Validator要求：委托到Accessor，不维护本地状态
     * 获取扫描任务路径列表（测试兼容方法）
     */
    getScanningTasks(): string[] {
        return this.fangXuanLingService.scanning.queue.map((action) => action.path);
    }

    /**
     * ✅ Validator要求：委托到Accessor，不维护本地状态
     * 获取队列大小（测试兼容方法）
     */
    getQueueSize(): number {
        return this.fangXuanLingService.scanning.queueSize;
    }

    /**
     * ✅ Validator要求：委托到Accessor，不维护本地状态
     * 检查路径是否正在扫描（测试兼容方法）
     */
    isScanning(path: string): boolean {
        return this.fangXuanLingService.scanning.isInQueue(path);
    }

    /**
     * ✅ Validator要求：队列由房玄龄管理，尉迟恭不维护本地状态
     * 清理方法（测试兼容）
     */
    cleanup(): void {
        logger.info("🛡️ 尉迟恭：清理完毕（队列由房玄龄管理）");
    }

    /**
     * 更新扫描进度（UI展示用）
     * ❌ RFC 0042: 注释掉 - UI层不应该更新进度，应由千里眼（Qianliyan）在底层自动管理
     * 进度更新应该在扫描引擎层面自动同步到store，UI只负责读取显示
     */
    // updateScanProgress(path: string, progress: { current: number; total: number }): void {
    //     logger.debug(`🛡️ 尉迟恭：更新扫描进度 ${path} ${progress.current}/${progress.total}`);
    //     this.fangXuanLingService.scanning.updateProgress(path, {
    //         processed: progress.current,
    //         total: progress.total,
    //     });
    // }

    // ✅ RFC 0042 Step 2.5: handleUpdateFolderTree已迁移到魏征服务

    /**
     * 初始化扫描队列（应用启动时调用）
     * 从天界恢复持久化的扫描队列
     *
     * @description
     * 初始化流程：
     * ```
     * 尉迟恭启动初始化
     *       ↓
     * 向房玄龄发送GET_SCANNING_QUEUE奏折
     *       ↓
     * 房玄龄 → 袁天罡 → 天界Tianshu
     *       ↓
     * Tianshu执行get_scanning_queue工作流
     *       ↓
     * 工作流调用千里眼.restoreQueue()
     *       ↓
     * 天界返回队列数据
     *       ↓
     * 房玄龄更新ScanningStore
     *       ↓
     * 尉迟恭从Store读取队列并排序
     *       ↓
     * 初始化完成
     * ```
     */
    async initializeScanningQueue(): Promise<void> {
        try {
            logger.info("🛡️ 尉迟恭呈文房玄龄，请求典籍中扫描队列");

            // 向房玄龄发送奏折，请求获取扫描队列
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.GET_SCANNING_QUEUE,
                content: { [SCAN_QUEUE_RESTORE_FROM_DISK]: true },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const response = await this.fangXuanLingService.processZouzhe(zouzhe);

            if (response.approved) {
                // ✅ 获取 Store 中的所有任务（包含状态）
                const allTasks = this.scanningQueue;

                if (allTasks.length > 0) {
                    logger.info(`🛡️ 尉迟恭：开始状态恢复，共 ${allTasks.length} 个任务`);

                    // ✅ RFC 0048 v3: 状态恢复逻辑
                    const now = Date.now();

                    // ✅ RFC 0056: 使用提取的方法简化条件分支
                    for (const task of allTasks) {
                        if (task.status === "processing") {
                            // 1. processing → pending（孤儿任务：上次应用崩溃时正在执行的任务）
                            await this.handleProcessingTask(task);
                        } else if (task.status === "failed") {
                            // 2. failed → 重试或删除（超24h删除）
                            await this.handleFailedTask(task, now);
                        } else {
                            // 3. pending 或无状态（兼容旧格式）→ 恢复到p-queue继续执行
                            this.handlePendingTask(task);
                        }
                    }

                    logger.info(`🛡️ 尉迟恭：扫描队列初始化完成，自动继续执行`);
                } else {
                    logger.info("🛡️ 尉迟恭：扫描队列为空，无需恢复");
                }
            } else {
                logger.warn("🛡️ 尉迟恭：未能获取扫描队列数据，使用空队列启动");
            }
        } catch (error) {
            // 失败时使用空队列，不影响应用启动
            logger.error("🛡️ 尉迟恭：获取扫描队列失败:", error);
            logger.info("🛡️ 尉迟恭：使用空队列继续启动");
        }
    }

    // ✅ RFC 0042 Step 2.5: initializeFolderTree已迁移到魏征服务的initializeAppState()

    /**
     * 将任务添加到执行队列（RFC 0056: 提取公共函数，消除代码重复）
     *
     * @description
     * 统一处理任务入队逻辑，消除三处重复代码块。
     * 包含统一的错误处理，提高可维护性。
     *
     * @param task 扫描队列任务
     * @param context 上下文描述（用于日志）
     * @private
     * @since RFC 0056
     */
    private enqueueTask(task: ScanQueueItem, context: string): void {
        this.scanQueue
            .add(() => this.executeScan(task.path, task.action, task.operationType))
            .catch((error) => {
                logger.error(`🛡️ 尉迟恭：${context}执行失败 ${task.path}`, error);
            });
    }

    /**
     * 处理processing状态任务（孤儿任务恢复）
     *
     * @description
     * 将processing状态的任务重置为pending，并添加到执行队列。
     * 用于应用重启后恢复上次崩溃时正在执行的任务。
     *
     * @param task 扫描队列任务
     * @private
     * @since RFC 0056
     */
    private async handleProcessingTask(task: ScanQueueItem): Promise<void> {
        logger.warn(`🛡️ 尉迟恭：发现孤儿任务 ${task.path}，重置为pending`);
        await this.updateTaskStatus(task.path, "pending", {
            startedAt: undefined,
        });
        this.enqueueTask(task, "孤儿任务");
    }

    /**
     * 处理failed状态任务（失败任务重试或删除）
     *
     * @description
     * 根据任务年龄和重试次数决定是重试还是删除。
     * 使用纯函数进行决策，提高可测试性和可维护性。
     *
     * @param task 扫描队列任务
     * @param now 当前时间戳
     * @private
     * @since RFC 0056
     */
    private async handleFailedTask(task: ScanQueueItem, now: number): Promise<void> {
        // ✅ RFC 0056: 使用纯函数进行决策
        const taskAge = calculateTaskAge(now, task.createdAt);
        const action = getFailedTaskAction(taskAge, task.retryCount, task.maxRetries);

        switch (action) {
            case "delete-ttl": {
                const hoursAgo = calculateHoursAgo(taskAge);
                logger.info(`🛡️ 尉迟恭：删除超时失败任务 ${task.path}（已失败${hoursAgo}小时）`);
                await this.deleteTask(task.path);
                break;
            }
            case "retry": {
                const nextRetryCount = calculateNextRetryCount(task.retryCount);
                logger.info(
                    `🛡️ 尉迟恭：重试失败任务 ${task.path}（重试${nextRetryCount}/${task.maxRetries}）`,
                );
                await this.updateTaskStatus(task.path, "pending", {
                    retryCount: nextRetryCount,
                    error: undefined,
                });
                this.enqueueTask(task, "失败任务重试");
                break;
            }
            case "delete-max-retries": {
                logger.warn(
                    `🛡️ 尉迟恭：删除达到重试上限的失败任务 ${task.path}（${task.retryCount}/${task.maxRetries}）`,
                );
                await this.deleteTask(task.path);
                break;
            }
        }
    }

    /**
     * 处理pending状态任务（恢复执行）
     *
     * @description
     * 将pending状态的任务添加到执行队列继续执行。
     * 也用于兼容旧格式任务（无status字段）。
     *
     * @param task 扫描队列任务
     * @private
     * @since RFC 0056
     */
    private handlePendingTask(task: ScanQueueItem): void {
        // ✅ RFC 0056: 使用纯函数获取状态显示文本
        const statusText = getTaskStatusDisplayText(task);
        logger.info(`🛡️ 尉迟恭：恢复任务到执行队列 ${task.path}（状态：${statusText}）`);
        this.enqueueTask(task, "任务");
    }
}
