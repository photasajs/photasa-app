import { watchArray } from "@vueuse/core";
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
import { QizouMatters } from "@renderer/constants/qizou-shengzhi-commands";
import type { ScanAction } from "@common/scan-types";
import { loggers } from "@common/logger";
import { normalizePath } from "@renderer/utils/path";

// ✅ RFC 0042 Step 2.5: folderTree管理已迁移到魏征服务，不再需要folder-tree相关导入

const logger = loggers.yuchigong;

/**
 * 尉迟恭（YuChiGong）- 扫描队列业务协调官
 *
 * 职责：
 * 1. 接收李世民圣旨（add_scan_task / remove_scan_task）
 * 2. 创建ScanAction对象并发送ADD_SCAN_ACTION奏折给房玄龄
 * 3. 通过FangXuanLing.scanning Accessor去重检查（不维护本地状态）
 * 4. 通过qizou启奏向李世民汇报任务结果
 *
 * **架构原则**（RFC 0042 Step 1）：
 * - ✅ 不维护本地状态 - 所有队列访问委托给FangXuanLing.scanning Accessor
 * - ✅ 使用Accessor去重检查 - fangXuanLingService.scanning.isInQueue(path)
 * - ✅ 发送单个action奏折（ADD_SCAN_ACTION）- 不发送完整队列
 * - ✅ 房玄龄负责更新Store并触发天界持久化（matter-sync.yml）
 *
 * **协调链路**（RFC 0042 Phase 2.4修正版）：
 * 褚遂良完成路径添加 → 启奏李世民 → 李世民下旨尉迟恭 →
 * 尉迟恭发ADD_SCAN_ACTION奏折给房玄龄（单个action） →
 * 房玄龄 → 袁天罡 → 天枢工作流（add_scan_action.yml）→
 * 千里眼引擎执行业务逻辑（恢复队列 → append操作 → 持久化）→
 * 天枢返回完整队列快照 → 房玄龄Store Automation自动同步
 *
 * @class YuChiGongService
 * @implements {IService}
 * @since RFC 0038 Phase 7 - qizou-shengzhi架构
 * @updated RFC 0042 Phase 2.4修正 - 单个action奏折流程，Store为SSOT
 * @date 2025-10-19
 */
export class YuChiGongService implements IService, IYuChiGongService {
    /**
     * 启奏事件总线
     * 用于向李世民发送qizou启奏
     */
    private _qizouBus: Emitter<{ qizou: Qizou }> | null = null;

    /**
     * 扫描处理标志
     * 防止并发扫描
     */
    private isProcessing = false;

    constructor(private fangXuanLingService: IFangXuanLingService) {
        logger.info("🛡️ 尉迟恭就任，负责扫描队列业务逻辑管理");
        this.startAutoScan(); // 启动自动扫描监听
    }

    /**
     * 启动自动扫描监听
     * 监听队列变化，自动触发扫描
     *
     * @private
     * @since RFC 0048
     * @fix 使用 watchArray 正确追踪 getter 返回的响应式数组
     */
    private startAutoScan(): void {
        logger.info("🛡️ 尉迟恭：启动自动扫描监听");
        watchArray(
            () => this.scanningQueue,
            () => {
                logger.debug("🛡️ 尉迟恭：检测到扫描队列变化");
                if (!this.isProcessing && this.scanningQueue.length > 0) {
                    logger.info(`🛡️ 尉迟恭：队列有 ${this.scanningQueue.length} 个任务，触发扫描`);
                    setTimeout(() => this.processNextTask(), 0);
                } else {
                    logger.debug(
                        `🛡️ 尉迟恭：isProcessing=${this.isProcessing}, queue.length=${this.scanningQueue.length}`,
                    );
                }
            },
            { deep: true },
        );
    }

    /**
     * 处理下一个扫描任务（RFC 0048 - 核心扫描逻辑）
     *
     * @description
     * 扫描编排7步流程：
     * 1. 启奏开始
     * 2. 重扫描时重置配置
     * 3. 文件操作 - 记录父目录
     * 4. 目录操作 - 扫描子文件夹
     * 5. 执行扫描
     * 6. 移除任务
     * 7. 启奏完成/失败
     *
     * @private
     * @since RFC 0048
     */
    private async processNextTask(): Promise<void> {
        const task = this.scanningQueue[0];
        if (!task) return;
        this.isProcessing = true;

        // 1. 启奏开始
        this.emitQizou("scan_started", { path: task.path });

        try {
            // 2. 重扫描时重置配置
            if (task.action === "rescan" && task.operationType === "directory") {
                await window.api.resetPhotasaConfig(task.path);
            }

            // 3. 文件操作 - 记录父目录
            let parentDir: string | null = null;
            if (task.operationType === "file") {
                parentDir = window.api.toDirName(task.path);
            }

            // 4. 目录操作 - 扫描子文件夹
            if (task.operationType === "directory") {
                const subfolders = await window.api.scanSubfolders(task.path);
                if (subfolders.length > 0) {
                    await this.addScanTasks(subfolders, "scan");
                }
            }

            // 5. 执行扫描
            await window.api.scanPhotos({
                path: task.path,
                action: task.action,
                thumbnailSize: 150,
                isDirectory: task.operationType !== "file",
            });

            // 6. 移除任务
            await this.removeScanTask(task.path);

            // 7. 启奏完成
            this.emitQizou("scan_completed", {
                path: task.path,
                parentDir: parentDir,
                operationType: task.operationType,
            });
        } catch (error) {
            logger.error(`🛡️ 扫描失败 ${task.path}`, error);
            await this.removeScanTask(task.path);
            this.emitQizou("scan_failed", { path: task.path, error: String(error) });
        }

        this.isProcessing = false;
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
        const path = shengzhi.content.path;

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

        logger.info(`🛡️ 尉迟恭接旨：添加扫描任务 ${path}`);

        try {
            // 1. ✅ Validator要求：使用Accessor去重检查，不维护本地Set
            if (this.fangXuanLingService.scanning.isInQueue(path)) {
                logger.warn(`🛡️ 尉迟恭：扫描任务已存在，跳过添加 ${path}`);
                this.emitQizou("scan_task_duplicate", {
                    shengzhiId: shengzhi.id,
                    path,
                });
                return;
            }

            // 2. 创建ScanAction对象
            const scanAction: ScanAction = {
                path,
                action: (shengzhi.content.action as "scan" | "rescan" | "current") || "scan",
                thumbnailSize: 150, // 默认缩略图大小
                source: (shengzhi.content.source as "user" | "auto") || "user",
                timestamp: Date.now(),
                operationType: "directory",
            };

            // 3. ✅ RFC 0042要求：只发送ADD_SCAN_ACTION奏折
            // 房玄龄负责更新Store并触发天界持久化
            const addActionZouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                content: { actions: [scanAction] }, // ✅ 修复：工作流期望 actions 数组
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info(`🛡️ 尉迟恭向房玄龄呈递添加扫描任务奏折: ${path}`);
            const response = await this.fangXuanLingService.processZouzhe(addActionZouzhe);

            if (!response.approved) {
                throw new Error(`房玄龄未批准：${response.instruction}`);
            }

            // 4. ✅ 响应圣旨时不发送 SCAN_TASK_ADDED 启奏
            // 原因：避免循环 - 在 add_path_completed 流程中，魏征已通过 add_root 圣旨处理了路径
            // SCAN_TASK_ADDED 启奏只在直接调用 addScanTasks() 时发送，用于触发魏征的 add_paths 批量处理

            logger.info(`🛡️ 尉迟恭：扫描任务已添加（响应圣旨） ${path}`);
        } catch (error) {
            logger.error(`🛡️ 尉迟恭：添加扫描任务失败 ${path}`, error);

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
     * 处理清理扫描队列圣旨（移除监控文件夹时）
     * ✅ Bug修复：当移除监控文件夹时，需要清理该路径及其所有子目录的未扫描任务
     *
     * @param shengzhi 圣旨内容，包含要清理的路径
     */
    private async handleCleanupScanQueueForPath(shengzhi: Shengzhi): Promise<void> {
        const path = shengzhi.content.path;

        // 路径参数验证
        if (!path || typeof path !== "string") {
            logger.error("🛡️ 尉迟恭：圣旨缺少path参数或类型错误");
            this.emitQizou("scan_queue_cleanup_failed", {
                shengzhiId: shengzhi.id,
                error: "缺少path参数或类型错误",
            });
            return;
        }

        // 路径安全验证：不能为空字符串
        if (path.trim() === "") {
            logger.error("🛡️ 尉迟恭：圣旨path为空字符串");
            this.emitQizou("scan_queue_cleanup_failed", {
                shengzhiId: shengzhi.id,
                error: "path为空字符串",
            });
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
                // 即使没有任务，也向李世民启奏汇报
                this.emitQizou("scan_queue_cleanup_completed", {
                    shengzhiId: shengzhi.id,
                    path: normalizedPathToRemove,
                    removedCount: 0,
                });
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
                );
                this.emitQizou("scan_queue_cleanup_partially_completed", {
                    shengzhiId: shengzhi.id,
                    path: normalizedPathToRemove,
                    removedCount: successCount,
                    failedCount,
                    errors,
                });
            } else {
                logger.info(`🛡️ 尉迟恭：成功清理 ${successCount} 个扫描任务（包括子目录）`);
                this.emitQizou("scan_queue_cleanup_completed", {
                    shengzhiId: shengzhi.id,
                    path: normalizedPathToRemove,
                    removedCount: successCount,
                });
            }
        } catch (error) {
            logger.error(`🛡️ 尉迟恭：清理扫描队列失败 ${normalizedPathToRemove}`, error);

            // 向李世民启奏汇报失败
            this.emitQizou("scan_queue_cleanup_failed", {
                shengzhiId: shengzhi.id,
                path: normalizedPathToRemove,
                error: String(error),
            });

            throw error;
        }
    }

    /**
     * 处理移除扫描任务圣旨（扫描完成后移除单个任务）
     * @param shengzhi 圣旨内容
     */
    private async handleRemoveScanTask(shengzhi: Shengzhi): Promise<void> {
        const path = shengzhi.content.path;

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
     * 扫描队列（只读属性）
     * 返回原始ScanAction[]数组，UI层使用computed做转换
     * 委托到房玄龄的ScanningStore Accessor
     */
    get scanningQueue(): ScanAction[] {
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

    /**
     * 批量添加扫描任务到队列（核心实现）
     * @param paths 要扫描的路径数组
     * @param action 扫描动作类型，可选，默认为 "scan"
     *
     * @description
     * Linus "好品味"设计：批量处理，单次通信
     * - addScanTask(path) 只是 addScanTasks([path]) 的便利方法
     * - 批量去重、批量创建、一次性发送给天界
     */
    async addScanTasks(
        paths: string[],
        action: "scan" | "rescan" | "current" = "scan",
    ): Promise<void> {
        logger.info(`🛡️ 尉迟恭：批量添加扫描任务，共${paths.length}个路径`);

        // 1. 批量验证和去重
        const validPaths: string[] = [];
        const duplicatePaths: string[] = [];

        // 批量验证和去重
        paths.forEach((path) => {
            if (!path || typeof path !== "string" || path.trim() === "") {
                logger.error(`🛡️ 尉迟恭：路径参数无效：${path}`);
                return;
            }

            if (this.fangXuanLingService.scanning.isInQueue(path)) {
                duplicatePaths.push(path);
            } else {
                validPaths.push(path);
            }
        });

        // 如果没有新路径需要添加，直接返回
        if (validPaths.length === 0) {
            logger.info(
                `🛡️ 尉迟恭：所有路径已存在或无效 (重复${duplicatePaths.length}个，无效${paths.length - duplicatePaths.length}个)`,
            );
            // 批量汇报重复路径（如果有）
            if (duplicatePaths.length > 0) {
                this.emitQizou(QizouMatters.SCAN_TASK_ADDED, {
                    paths: duplicatePaths,
                    persisted: true,
                });
            }
            return;
        }

        try {
            // 2. 批量创建ScanAction对象
            const scanActions: ScanAction[] = validPaths.map((path) => ({
                path,
                action,
                thumbnailSize: 150,
                source: "user",
                timestamp: Date.now(),
                operationType: "directory" as const,
            }));

            // 3. ✅ 一次性发送ADD_SCAN_ACTION奏折（天界支持数组）
            const addActionZouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                content: { actions: scanActions }, // 发送数组
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info(`🛡️ 尉迟恭向房玄龄呈递批量添加扫描任务奏折: ${validPaths.length}个路径`);
            const response = await this.fangXuanLingService.processZouzhe(addActionZouzhe);

            if (!response.approved) {
                throw new Error(`房玄龄未批准：${response.instruction}`);
            }

            // 4. 批量启奏汇报所有新添加的路径
            const persisted = (response.data as Record<string, unknown>)?.persisted === true;

            this.emitQizou(QizouMatters.SCAN_TASK_ADDED, {
                paths: validPaths,
                persisted,
            });

            logger.info(
                `🛡️ 尉迟恭：批量添加完成 (新增${validPaths.length}个，重复${duplicatePaths.length}个)`,
            );
        } catch (error) {
            logger.error(`🛡️ 尉迟恭：批量添加失败`, error);
            throw error;
        }
    }

    /**
     * 添加单个扫描任务到队列（便利方法）
     * @param path 要扫描的路径
     * @param action 扫描动作类型，可选，默认为 "scan"
     *
     * @description
     * 这只是 addScanTasks([path]) 的便利方法
     * 所有实际逻辑都在 addScanTasks 中实现
     */
    async addScanTask(path: string, action: "scan" | "rescan" | "current" = "scan"): Promise<void> {
        return this.addScanTasks([path], action);
    }

    /**
     * 移除扫描任务从队列
     * @param path 要移除的路径
     *
     * @description
     * Linus "好品味"设计：统一数据流
     * - 移除操作也走奏折系统
     * - 利用现有 remove_scan_action.yml 工作流
     * - Store Automation自动同步
     * - watchArray监听到变化，自动触发下一个任务
     */
    async removeScanTask(path: string): Promise<void> {
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
            // 队列检查（可选优化）
            if (!this.fangXuanLingService.scanning.isInQueue(path)) {
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
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const response = await this.fangXuanLingService.processZouzhe(zouzhe);

            // ✅ Validator要求：委托给房玄龄，队列在Store中
            if (response.approved) {
                const queueSize = this.fangXuanLingService.scanning.queueSize;
                logger.info(`🛡️ 尉迟恭：扫描队列初始化完成，共${queueSize}个任务`);
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
}
