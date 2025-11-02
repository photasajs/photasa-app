import { IService } from "@common/interfaces/service.interface";
import { IYuChiGongService } from "@renderer/interfaces/yu-chi-gong.interface";
import type { Shengzhi } from "@common/interfaces/shengzhi.interface";
import type { Qizou } from "@common/interfaces/qizou.interface";
import type { Emitter } from "mitt";
import { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import {
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
    GUANYUAN_NAMES,
    type Zouzhe,
} from "@renderer/interfaces/fang-xuan-ling.interface";
import type { ScanAction } from "@common/scan-types";
import { loggers } from "@common/logger";
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

    constructor(private fangXuanLingService: IFangXuanLingService) {
        logger.info("🛡️ 尉迟恭就任，负责扫描队列业务逻辑管理");
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
                content: { action: scanAction },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info(`🛡️ 尉迟恭向房玄龄呈递添加扫描任务奏折: ${path}`);
            const response = await this.fangXuanLingService.processZouzhe(addActionZouzhe);

            if (!response.approved) {
                throw new Error(`房玄龄未批准：${response.instruction}`);
            }

            // 4. ✅ Validator要求：向李世民启奏汇报任务已添加（不是started）
            this.emitQizou("scan_task_added", {
                shengzhiId: shengzhi.id,
                path,
                persisted: (response.data as Record<string, unknown>)?.persisted === true,
            });

            logger.info(`🛡️ 尉迟恭：扫描任务已添加 ${path}`);
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
     * 处理移除扫描任务圣旨
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
