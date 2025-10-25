/**
 * 扫描队列访问器（ScanningAccessor）
 *
 * 职责：
 * - 封装扫描队列的只读访问逻辑
 * - 提供统一的队列查询接口
 * - 保护Store不被直接访问
 *
 * 设计理念：
 * 如同朝廷典籍管理，房玄龄作为宰相，提供典籍查阅服务，
 * 但不允许直接改动卷宗，所有修改需经奏折呈递、圣旨批准。
 */

import type { ScanAction } from "@common/scan-types";
import type { ScanningStore } from "../scanning-store";
import { loggers } from "@common/logger";

const logger = loggers.fangxuanling;

/**
 * 扫描队列访问器接口
 *
 * ⚠️ 重要设计原则：只读访问模式
 * - 房玄龄只提供典籍查阅（只读访问）
 * - 所有修改操作需通过奏折系统（Zouzhe）
 * - 由其他官员（如尉迟恭）呈递奏折，经批准后执行
 */
export interface IScanningAccessor {
    /** 查阅扫描队列（只读副本） */
    readonly queue: ScanAction[];
    /** 查询队列大小（只读） */
    readonly queueSize: number;
    /** 查询当前处理状态（只读） */
    readonly isProcessing: boolean;
    /** 查询当前处理路径（只读） */
    readonly currentPath: string | null;
    /** 检查路径是否在队列中（只读查询） */
    isInQueue(path: string): boolean;
    /** 查询下一个待处理任务（只读） */
    readonly nextScanAction: ScanAction | null;
}

/**
 * ScanningStore访问器实现
 *
 * ✅ RFC 0042 Step 1: 只读访问器模式
 * ⚠️ 所有修改操作必须通过processZouzhe()提交奏折，不在此处提供
 */
export class ScanningAccessor implements IScanningAccessor {
    constructor(private readonly store: ScanningStore | null) {}

    /**
     * 查阅扫描队列（只读副本）
     * 如同翻阅典籍目录，只可查看不可改动
     */
    get queue(): ScanAction[] {
        if (!this.store) {
            logger.error("🏛️ 房玄龄：典籍库未开放，无法查阅扫描卷宗");
            return [];
        }
        return [...this.store.queue];
    }

    /**
     * 查询队列大小
     * 统计待处理卷宗数量
     */
    get queueSize(): number {
        if (!this.store) {
            logger.error("🏛️ 房玄龄：典籍库未开放，无法统计卷宗数量");
            return 0;
        }
        return this.store.queueSize;
    }

    /**
     * 查询处理状态
     * 了解当前是否有官员正在审阅卷宗
     */
    get isProcessing(): boolean {
        if (!this.store) {
            return false;
        }
        return this.store.isProcessing;
    }

    /**
     * 查询当前处理路径
     * 了解当前正在审阅哪份卷宗
     */
    get currentPath(): string | null {
        if (!this.store) {
            return null;
        }
        return this.store.currentPath;
    }

    /**
     * 查询下一个待处理任务
     * 预览待审卷宗中的下一份
     */
    get nextScanAction(): ScanAction | null {
        if (!this.store) {
            return null;
        }
        return this.store.nextScanAction;
    }

    /**
     * 检查路径是否在队列中（只读查询）
     * 查验某条路径是否已登记在册
     */
    isInQueue(path: string): boolean {
        if (!this.store) {
            logger.error("🏛️ 房玄龄：典籍库未开放，无法查验路径登记");
            return false;
        }
        return this.store.isInQueue(path);
    }
}
