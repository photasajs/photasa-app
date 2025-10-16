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
import { loggers } from "@common/logger";

const logger = loggers.app;

/**
 * 尉迟恭（YuChiGong）- 扫描队列UI状态管理
 *
 * 职责：
 * 1. 接收李世民圣旨（add_scan_task / remove_scan_task）
 * 2. 更新扫描队列UI状态（scanningFolder）
 * 3. 向房玄龄发送奏折，触发天界扫描执行
 * 4. 通过qizou启奏向李世民汇报任务结果
 *
 * **协调链路**：
 * 褚遂良完成路径添加 → 启奏李世民 → 李世民下旨尉迟恭 → 尉迟恭发奏折给房玄龄 → 天界执行扫描
 *
 * @class YuChiGongService
 * @implements {IService}
 * @since RFC 0038 Phase 7 - qizou-shengzhi架构
 * @date 2025-10-16
 */
export class YuChiGongService implements IService, IYuChiGongService {
    /**
     * 启奏事件总线
     * 用于向李世民发送qizou启奏
     */
    private _qizouBus: Emitter<{ qizou: Qizou }> | null = null;

    /**
     * 扫描任务队列
     * 存储待扫描和正在扫描的路径
     */
    private scanningTasks = new Set<string>();

    constructor(private fangXuanLingService: IFangXuanLingService) {
        logger.info("🛡️ 尉迟恭就任，负责扫描队列UI状态管理");
    }

    /**
     * IService接口实现 - 服务名称标识
     */
    get name(): string {
        return "尉迟恭";
    }

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
            // 1. 添加到扫描队列
            this.scanningTasks.add(path);
            logger.debug(
                `🛡️ 尉迟恭：扫描队列已添加 ${path}，当前队列长度: ${this.scanningTasks.size}`,
            );

            // 2. 向房玄龄发送奏折，触发天界扫描执行
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.START_SCAN,
                content: { path },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info(`🛡️ 尉迟恭向房玄龄呈递扫描奏折: ${path}`);
            await this.fangXuanLingService.processZouzhe(zouzhe);

            // 3. 向李世民启奏汇报任务已启动
            this.emitQizou("scan_task_started", {
                shengzhiId: shengzhi.id,
                path,
                queueSize: this.scanningTasks.size,
            });

            logger.info(`🛡️ 尉迟恭：扫描任务已启动 ${path}`);
        } catch (error) {
            logger.error(`🛡️ 尉迟恭：启动扫描任务失败 ${path}`, error);

            // 启动失败，从队列移除
            this.scanningTasks.delete(path);

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
            // 1. 从扫描队列移除
            const removed = this.scanningTasks.delete(path);

            if (!removed) {
                logger.warn(`🛡️ 尉迟恭：扫描队列中未找到任务 ${path}`);
            } else {
                logger.debug(
                    `🛡️ 尉迟恭：扫描队列已移除 ${path}，当前队列长度: ${this.scanningTasks.size}`,
                );
            }

            // 2. 向房玄龄发送奏折，通知天界停止扫描
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.STOP_SCAN,
                content: { path },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info(`🛡️ 尉迟恭向房玄龄呈递停止扫描奏折: ${path}`);
            await this.fangXuanLingService.processZouzhe(zouzhe);

            // 3. 向李世民启奏汇报任务已移除
            this.emitQizou("scan_task_removed", {
                shengzhiId: shengzhi.id,
                path,
                queueSize: this.scanningTasks.size,
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
     * 获取当前扫描队列状态
     * @returns 扫描队列的路径列表
     */
    getScanningTasks(): string[] {
        return Array.from(this.scanningTasks);
    }

    /**
     * 获取扫描队列长度
     * @returns 队列中的任务数量
     */
    getQueueSize(): number {
        return this.scanningTasks.size;
    }

    /**
     * 检查路径是否在扫描队列中
     * @param path 路径
     * @returns 是否在队列中
     */
    isScanning(path: string): boolean {
        return this.scanningTasks.has(path);
    }

    /**
     * 更新扫描进度（由袁天罡直接调用）
     * @param path 扫描路径
     * @param progress 进度信息
     * @description
     * 袁天罡监听天界IPC事件后，直接调用此方法更新UI状态
     * 不需要通过圣旨或启奏，这是直接的方法调用
     */
    updateScanProgress(path: string, progress: { current: number; total: number }): void {
        logger.debug(`🛡️ 尉迟恭更新扫描进度: ${path} (${progress.current}/${progress.total})`);
        // TODO: 更新UI状态，可以通过Vue reactive state实现
    }

    /**
     * 清理所有扫描任务（应用退出时调用）
     */
    cleanup(): void {
        logger.info("🛡️ 尉迟恭：开始清理所有扫描任务");
        this.scanningTasks.clear();
        logger.info("🛡️ 尉迟恭：扫描队列已清理完毕");
    }
}
