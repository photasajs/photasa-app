import { defineStore } from "pinia";
import type { ScanAction } from "@common/scan-types";
import { loggers } from "@common/logger";

const logger = loggers.app;

/**
 * 扫描状态接口
 *
 * ⚠️ 注意：此典籍不入库（persist: false）
 * 运行时卷宗状态，持久归档由天界千里眼掌管
 */
export interface ScanningState {
    /** 扫描队列 - 待审卷宗列表 */
    queue: ScanAction[];

    /** 是否正在处理 - 当前是否有官员在审阅 */
    isProcessing: boolean;

    /** 当前正在扫描的路径 - 正在审阅的卷宗 */
    currentPath: string | null;
}

/**
 * 扫描Store（扫描卷宗库）
 *
 * 职责：
 * - 管理扫描队列和扫描状态（卷宗登记与状态追踪）
 * - 提供队列增删改查接口（卷宗出入库管理）
 * - 管理扫描进度和状态（审阅进度记录）
 * - 不负责持久化（归档由天界千里眼掌管scanning.json）
 *
 * 访问方式：
 * - ❌ 服务不得擅入典籍库（禁止直接访问Store）
 * - ✅ 必须通过房玄龄提供的访问器（经宰相批准后访问）
 */
export const useScanningStore = defineStore("scanning", {
    state: (): ScanningState => ({
        queue: [],
        isProcessing: false,
        currentPath: null,
    }),

    getters: {
        /**
         * 查询队列大小
         * 统计待审卷宗数量
         */
        queueSize: (state) => state.queue.length,

        /**
         * 获取队列中的所有路径
         * 列出所有待审卷宗的路径清单
         */
        queuePaths: (state) => state.queue.map((action) => action.path),

        /**
         * 检查路径是否在队列中
         * 查验某条路径是否已登记在册
         */
        isInQueue: (state) => (path: string) => {
            return state.queue.some((action) => action.path === path);
        },

        /**
         * 获取下一个待扫描任务
         * 预览待审卷宗中的首份
         */
        nextScanAction: (state) => state.queue[0] || null,
    },

    actions: {
        /**
         * 添加到队列（卷宗入库登记）
         *
         * ⚠️ 内部方法：不得擅自调用
         * 应通过房玄龄宰相的奏折系统访问
         */
        addToQueue(action: ScanAction): void {
            logger.debug(`📋 卷宗库：新卷入册 ${action.path}`);
            this.queue.push(action);
        },

        /**
         * 从队列中移除（卷宗出库注销）
         *
         * ⚠️ 内部方法：不得擅自调用
         * 应通过房玄龄宰相的奏折系统访问
         */
        removeFromQueue(path: string): void {
            const index = this.queue.findIndex((action) => action.path === path);
            if (index >= 0) {
                logger.debug(`📋 卷宗库：卷宗销档 ${path}`);
                this.queue.splice(index, 1);
            }
        },

        /**
         * 清空队列（典籍库清理）
         * 所有待审卷宗归档封存
         */
        clearQueue(): void {
            logger.info("📋 卷宗库：清理库房，所有卷宗封存");
            this.queue = [];
            this.isProcessing = false;
            this.currentPath = null;
        },

        /**
         * 批量设置队列（从天界恢复卷宗）
         * 应用重启后，从千里眼处取回卷宗清单
         */
        setQueue(queue: ScanAction[]): void {
            logger.info(`📋 卷宗库：从天界恢复卷宗，共${queue.length}份待审`);
            this.queue = [...queue];
        },

        /**
         * 更新处理状态（更新审阅状态）
         * 记录当前是否有官员在审阅，以及审阅哪份卷宗
         */
        setProcessingStatus(isProcessing: boolean, currentPath: string | null = null): void {
            this.isProcessing = isProcessing;
            this.currentPath = currentPath;
        },

        /**
         * 更新扫描任务进度（更新审阅进度）
         * 记录卷宗审阅的当前进度
         */
        updateProgress(path: string, progress: { processed: number; total: number }): void {
            const action = this.queue.find((a) => a.path === path);
            if (action) {
                action.progress = {
                    processed: progress.processed,
                    total: progress.total,
                    cacheEnabled: true,
                };
            }
        },
    },

    // ⚠️ 关键：不持久化到localStorage
    // 运行时卷宗状态，持久归档由天界千里眼掌管
    persist: false,
});

/**
 * ScanningStore类型导出
 * 供TypeScript类型检查使用
 */
export type ScanningStore = ReturnType<typeof useScanningStore>;
