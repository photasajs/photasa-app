import { ref, computed, type Ref } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { loggers } from "@photasa/common";

const logger = loggers.scan;

/**
 * 扫描监控配置
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
 * 扫描健康状态
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
 * 扫描监控服务
 * 负责监控扫描队列状态，检测异常并自动恢复
 */
class ScanMonitoringService {
    private config: ScanMonitorConfig;
    private healthCheckTimer: NodeJS.Timeout | null = null;
    private lastActivityTime = ref<number>(Date.now());
    private consecutiveFailures = ref<number>(0);
    private isMonitoring = ref<boolean>(false);
    private lastQueueLength = ref<number>(0);
    private scanStartCallback: (() => void) | null = null;
    private scanIdleChecker: (() => boolean) | null = null;

    /** 健康状态 */
    public healthStatus: Ref<ScanHealthStatus>;

    constructor() {
        // 默认配置
        this.config = {
            healthCheckInterval: 5 * 60 * 1000, // 5分钟
            staleTimeout: 30 * 60 * 1000, // 30分钟
            idleTimeout: 5 * 60 * 1000, // 5分钟
            maxRetries: 3,
            enableAutoRecovery: true,
        };

        // 初始化健康状态
        this.healthStatus = computed(() => this.getHealthStatus());

        logger.info("[扫描监控] 服务已初始化", this.config);
    }

    /**
     * 设置扫描状态检查器
     */
    setScanIdleChecker(checker: () => boolean): void {
        this.scanIdleChecker = checker;
    }

    /**
     * 更新配置
     */
    updateConfig(config: Partial<ScanMonitorConfig>): void {
        this.config = { ...this.config, ...config };
        logger.info("[扫描监控] 配置已更新", this.config);

        // 如果正在监控，重启以应用新配置
        if (this.isMonitoring.value) {
            this.stopMonitoring();
            this.startMonitoring();
        }
    }

    /**
     * 开始监控
     */
    startMonitoring(scanStartCallback?: () => void): void {
        if (this.isMonitoring.value) {
            logger.warn("[扫描监控] 监控已在运行中");
            return;
        }

        this.scanStartCallback = scanStartCallback || null;
        this.isMonitoring.value = true;
        this.lastActivityTime.value = Date.now();
        this.consecutiveFailures.value = 0;

        // 启动健康检查定时器
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);

        logger.info("[扫描监控] 监控已启动");
    }

    /**
     * 停止监控
     */
    stopMonitoring(): void {
        if (!this.isMonitoring.value) {
            return;
        }

        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        this.isMonitoring.value = false;
        this.scanStartCallback = null;
        logger.info("[扫描监控] 监控已停止");
    }

    /**
     * 记录扫描活动
     */
    recordActivity(): void {
        this.lastActivityTime.value = Date.now();
        this.consecutiveFailures.value = 0; // 重置失败计数
        logger.debug("[扫描监控] 记录扫描活动");
    }

    /**
     * 记录扫描失败
     */
    recordFailure(): void {
        this.consecutiveFailures.value++;
        logger.warn(`[扫描监控] 记录扫描失败，连续失败次数: ${this.consecutiveFailures.value}`);
    }

    /**
     * 获取健康状态
     */
    private getHealthStatus(): ScanHealthStatus {
        const preferenceStore = usePreferenceStore();
        const scanningFolder = preferenceStore.scanningFolder;
        const queueLength = scanningFolder.length;
        const now = Date.now();
        const idleDuration = now - this.lastActivityTime.value;

        // 检查扫描任务是否空闲
        const isIdle = this.checkIfScanIsIdle();

        // 判断是否停滞
        const isStale = this.isStaleDetected(queueLength, isIdle, idleDuration);

        // 判断是否健康
        const isHealthy = this.isSystemHealthy(queueLength, isIdle, isStale);

        // 生成状态消息
        const message = this.generateHealthMessage(queueLength, isIdle, isStale, idleDuration);

        return {
            isHealthy,
            queueLength,
            isIdle,
            lastActivityTime: this.lastActivityTime.value,
            idleDuration,
            isStale,
            consecutiveFailures: this.consecutiveFailures.value,
            message,
        };
    }

    /**
     * 检查扫描是否空闲
     */
    private checkIfScanIsIdle(): boolean {
        return this.scanIdleChecker ? this.scanIdleChecker() : true;
    }

    /**
     * 检测是否停滞
     */
    private isStaleDetected(queueLength: number, isIdle: boolean, idleDuration: number): boolean {
        // 情况1：队列非空但扫描空闲超过阈值
        if (queueLength > 0 && isIdle && idleDuration > this.config.idleTimeout) {
            return true;
        }

        // 情况2：扫描运行但长时间无活动
        if (!isIdle && idleDuration > this.config.staleTimeout) {
            return true;
        }

        // 情况3：队列长度长时间未变化
        if (
            queueLength > 0 &&
            queueLength === this.lastQueueLength.value &&
            idleDuration > this.config.staleTimeout
        ) {
            return true;
        }

        return false;
    }

    /**
     * 判断系统是否健康
     */
    private isSystemHealthy(queueLength: number, isIdle: boolean, isStale: boolean): boolean {
        // 连续失败次数超过阈值
        if (this.consecutiveFailures.value >= this.config.maxRetries) {
            return false;
        }

        // 检测到停滞
        if (isStale) {
            return false;
        }

        // 队列非空但扫描空闲（短时间内是正常的）
        if (queueLength > 0 && isIdle) {
            const idleDuration = Date.now() - this.lastActivityTime.value;
            if (idleDuration > this.config.idleTimeout) {
                return false;
            }
        }

        return true;
    }

    /**
     * 生成健康状态消息
     */
    private generateHealthMessage(
        queueLength: number,
        isIdle: boolean,
        isStale: boolean,
        idleDuration: number,
    ): string {
        if (this.consecutiveFailures.value >= this.config.maxRetries) {
            return `扫描失败次数过多 (${this.consecutiveFailures.value}次)，需要人工干预`;
        }

        if (isStale) {
            if (queueLength > 0 && isIdle) {
                return `队列有${queueLength}个任务但扫描空闲超过${Math.floor(idleDuration / 1000 / 60)}分钟`;
            }
            if (!isIdle) {
                return `扫描运行中但${Math.floor(idleDuration / 1000 / 60)}分钟无进度`;
            }
        }

        if (queueLength === 0) {
            return "扫描队列为空";
        }

        if (isIdle) {
            return `队列有${queueLength}个任务，扫描空闲中`;
        }

        return `正在扫描，队列剩余${queueLength}个任务`;
    }

    /**
     * 执行健康检查
     */
    private performHealthCheck(): void {
        const status = this.getHealthStatus();

        logger.debug("[扫描监控] 健康检查", {
            isHealthy: status.isHealthy,
            queueLength: status.queueLength,
            isIdle: status.isIdle,
            isStale: status.isStale,
            message: status.message,
        });

        // 更新队列长度记录
        this.lastQueueLength.value = status.queueLength;

        // 如果不健康且启用自动恢复
        if (!status.isHealthy && this.config.enableAutoRecovery) {
            this.attemptRecovery(status);
        }
    }

    /**
     * 尝试恢复扫描
     */
    private attemptRecovery(status: ScanHealthStatus): void {
        // 如果失败次数过多，停止自动恢复
        if (this.consecutiveFailures.value >= this.config.maxRetries) {
            logger.error("[扫描监控] 连续失败次数过多，停止自动恢复");
            this.stopMonitoring();
            return;
        }

        logger.warn("[扫描监控] 检测到异常，尝试恢复", status.message);

        // 触发扫描重启
        if (this.scanStartCallback) {
            try {
                this.scanStartCallback();
                logger.info("[扫描监控] 已触发扫描重启");
                this.recordActivity(); // 记录活动
            } catch (error) {
                logger.error("[扫描监控] 恢复失败", error);
                this.recordFailure();
            }
        } else {
            logger.warn("[扫描监控] 未设置扫描启动回调，无法自动恢复");
        }
    }

    /**
     * 手动触发健康检查
     */
    checkHealthNow(): ScanHealthStatus {
        this.performHealthCheck();
        return this.getHealthStatus();
    }

    /**
     * 重置监控状态
     */
    reset(): void {
        this.lastActivityTime.value = Date.now();
        this.consecutiveFailures.value = 0;
        this.lastQueueLength.value = 0;
        logger.info("[扫描监控] 状态已重置");
    }

    /**
     * 获取监控状态
     */
    getMonitoringStatus(): {
        isMonitoring: boolean;
        config: ScanMonitorConfig;
        healthStatus: ScanHealthStatus;
    } {
        return {
            isMonitoring: this.isMonitoring.value,
            config: this.config,
            healthStatus: this.getHealthStatus(),
        };
    }
}

// 导出单例实例
export const scanMonitoringService = new ScanMonitoringService();

// 导出类型
export type { ScanMonitoringService };
