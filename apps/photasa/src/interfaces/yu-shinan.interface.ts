/**
 * 虞世南服务接口
 * RFC 0057: 负责扫描进度的 UI 实时展示
 *
 * 历史背景：
 * 虞世南，唐朝秘书监，主持编纂《北堂书钞》
 * 在架构中负责实时记录和展示扫描状态
 */

/**
 * 虞世南服务接口
 * 负责扫描进度和状态栏的 UI 实时展示
 *
 * 架构原则：
 * - ❌ 虞世南不持有响应式状态
 * - ✅ 虞世南接收圣旨并更新 photoStore、scanningStore 和 statusBarStore
 * - ✅ 扫描中状态由 scanningStore 队列状态派生
 * - ✅ 虞世南提供 getter 供 UI 访问（通过房玄龄）
 * - ✅ UI 通过 useYuShiNan() → 虞世南 → 房玄龄 → Store
 */
export interface IYuShiNanService {
    /**
     * 当前正在扫描的文件路径（只读）
     * 虞世南通过房玄龄访问 photoStore.processingFile，仅用于进度文件文案
     */
    readonly currentScanningFile: string;

    /**
     * 当前扫描进度（只读）
     * 虞世南通过房玄龄访问 photoStore.scanProgress
     */
    readonly scanProgress: number;

    /**
     * ✅ RFC 0057: 状态栏当前任务（只读）
     * 虞世南管理 statusBarStore.currentTask
     */
    readonly currentTask: string;

    /**
     * ✅ RFC 0057: 状态栏状态（只读）
     * 虞世南管理 statusBarStore.status
     */
    readonly status: string;

    /**
     * ✅ RFC 0057: 状态栏进度（只读）
     * 虞世南管理 statusBarStore.progress
     */
    readonly progress: number | undefined;

    /**
     * ✅ RFC 0057: 状态栏错误信息（只读）
     * 虞世南管理 statusBarStore.error
     */
    readonly error: string | undefined;

    /**
     * ✅ RFC 0057: 判断是否正在扫描（只读）
     * 从 scanningStore 队列处理状态派生
     */
    readonly isScanning: boolean;

    /**
     * ✅ RFC 0057: 获取扫描路径（只读）
     * 从 scanningStore 当前处理路径派生
     * 返回纯路径，UI 层负责添加 i18n 前缀
     */
    readonly scanningPath: string;

    /**
     * ✅ RFC 0057: 更新状态栏
     * Vue 组件通过此方法更新状态栏，而不是直接访问房玄龄
     */
    updateStatus(payload: {
        type: string;
        task: string;
        status: string;
        error?: string;
        timestamp: number;
        data?: unknown;
    }): void;

    /**
     * ✅ 获取扫描监控状态
     * 通过 yuShiNan 访问 scanMonitoringService，而不是直接导入
     */
    getMonitoringStatus(): {
        isMonitoring: boolean;
        config: ScanMonitorConfig;
        healthStatus: ScanHealthStatus;
    };

    /**
     * ✅ 获取扫描健康状态（响应式）
     * 通过 yuShiNan 访问 scanMonitoringService.healthStatus
     */
    readonly healthStatus: ScanHealthStatus;

    /**
     * ✅ 更新扫描监控配置
     * 通过 yuShiNan 访问 scanMonitoringService.updateConfig
     */
    updateMonitoringConfig(config: Partial<ScanMonitorConfig>): void;

    /**
     * ✅ 立即检查健康状态
     * 通过 yuShiNan 访问 scanMonitoringService.checkHealthNow
     */
    checkHealthNow(): ScanHealthStatus;

    /**
     * ✅ 重置监控状态
     * 通过 yuShiNan 访问 scanMonitoringService.reset
     */
    resetMonitoring(): void;
}

/**
 * ✅ 扫描监控配置类型
 */
export interface ScanMonitorConfig {
    /** 健康检查间隔（毫秒） */
    healthCheckInterval: number;
    /** 扫描停滞超时时间（毫秒） */
    staleTimeout: number;
    /** 空闲超时时间（毫秒） */
    idleTimeout: number;
    /** 最大重试次数 */
    maxRetries: number;
    /** 是否启用自动恢复 */
    enableAutoRecovery: boolean;
}

/**
 * ✅ 扫描健康状态类型
 */
export interface ScanHealthStatus {
    /** 是否健康 */
    isHealthy: boolean;
    /** 队列长度 */
    queueLength: number;
    /** 扫描是否空闲 */
    isIdle: boolean;
    /** 最后活动时间 */
    lastActivityTime: number;
    /** 空闲时长（毫秒） */
    idleDuration: number;
    /** 是否停滞 */
    isStale: boolean;
    /** 连续失败次数 */
    consecutiveFailures: number;
    /** 健康检查消息 */
    message: string;
}

/**
 * 扫描进度圣旨内容
 */
export interface ScanProgressShengzhiContent {
    /** 当前扫描的文件路径（完整路径） */
    filePath: string;
    /** 当前扫描任务路径（队列项路径） */
    scanPath?: string;
    /** 扫描进度（已处理文件数） */
    progress: number;
    /** 扫描总数 */
    total?: number;
    /** 扫描类型：progress 或 complete */
    type: "progress" | "complete";
}

/**
 * ✅ RFC 0057: 状态通知圣旨内容
 */
export interface StatusNotificationShengzhiContent {
    /** 任务类型，如 scan/thumbnail/import */
    type: string;
    /** 具体任务名或ID */
    task: string;
    /** 状态，如 start/success/fail/progress/skip */
    status: string;
    /** 错误信息 */
    error?: string;
    /** 时间戳 */
    timestamp: number;
    /** 相关数据 */
    data?: unknown;
}

/**
 * 虞世南服务注入 Token
 */
export const YU_SHINAN_TOKEN = Symbol("虞世南");
