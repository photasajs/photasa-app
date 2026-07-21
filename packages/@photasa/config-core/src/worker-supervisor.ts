/**
 * config worker 监管：心跳定时、退出/错误后的延迟重启与重启次数上限。
 * 不依赖 contract reference Worker 类型，仅使用回调与时间 API。
 */

export type WorkerSupervisorStatus = "initializing" | "ready" | "error" | "restarting";

const DEFAULT_HEARTBEAT_MS = 30_000;

export interface WorkerSupervisorOptions {
    /** 超过后不再调度 `recreateWorker` */
    maxRestartAttempts: number;
    /** 心跳间隔（毫秒） */
    heartbeatIntervalMs?: number;
    /** 向当前 worker 发送心跳 JSON 字符串 */
    sendHeartbeat: () => void;
    /** 异步重建 worker（与原先 `initializeWorker` 等价） */
    recreateWorker: () => void | Promise<void>;
    onStatusChange?: (status: WorkerSupervisorStatus) => void;
    onMaxRestartAttemptsReached?: () => void;
}

/**
 * 封装原先 ConfigService 内联的心跳与重启策略。
 */
export class WorkerSupervisor {
    private restartAttempts = 0;
    private status: WorkerSupervisorStatus = "initializing";
    private heartbeatTimer?: ReturnType<typeof setInterval>;
    private restartTimer?: ReturnType<typeof setTimeout>;
    private readonly heartbeatMs: number;

    constructor(private readonly options: WorkerSupervisorOptions) {
        this.heartbeatMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_MS;
    }

    getStatus(): WorkerSupervisorStatus {
        return this.status;
    }

    getRestartAttempts(): number {
        return this.restartAttempts;
    }

    private setStatus(next: WorkerSupervisorStatus): void {
        if (this.status === next) {
            return;
        }
        this.status = next;
        this.options.onStatusChange?.(next);
    }

    /** 首次收到有效 worker 消息时调用：就绪并清零重启计数 */
    markReadyFromMessage(): void {
        if (this.status === "initializing") {
            this.restartAttempts = 0;
            this.setStatus("ready");
        }
    }

    /** 开始 `initializeWorker` 时调用 */
    markInitializing(): void {
        this.setStatus("initializing");
    }

    startHealthCheck(): void {
        this.stopHealthCheckOnly();
        this.heartbeatTimer = setInterval(() => {
            if (this.status === "ready") {
                try {
                    this.options.sendHeartbeat();
                } catch {
                    this.setStatus("error");
                    this.requestRestartAfterWorkerFailure();
                }
            }
        }, this.heartbeatMs);
    }

    /** 停止心跳；不清理待定重启定时器（供 shutdown 全清） */
    stopHealthCheckOnly(): void {
        if (this.heartbeatTimer !== undefined) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
    }

    /** 释放心跳与待定重启 */
    dispose(): void {
        this.stopHealthCheckOnly();
        if (this.restartTimer !== undefined) {
            clearTimeout(this.restartTimer);
            this.restartTimer = undefined;
        }
    }

    /**
     * `createWorker` 等初始化失败：仅标记错误，不触发 `onStatusChange`、不调度重启（与原先 catch 仅改字段一致）。
     */
    notifyInitializerFailed(): void {
        this.status = "error";
    }

    /** worker `error` 事件：记错误并尝试重启 */
    notifyWorkerError(): void {
        this.setStatus("error");
        this.requestRestartAfterWorkerFailure();
    }

    /**
     * worker `exit`：`code !== 0` 时尝试重启；`code === 0` 仅标记错误（与原先行为一致）。
     */
    notifyWorkerExit(code: number): void {
        this.setStatus("error");
        if (code !== 0) {
            this.requestRestartAfterWorkerFailure();
        }
    }

    private requestRestartAfterWorkerFailure(): void {
        if (this.restartAttempts >= this.options.maxRestartAttempts) {
            this.options.onMaxRestartAttemptsReached?.();
            return;
        }

        this.restartAttempts += 1;
        this.setStatus("restarting");

        const delayMs = 1000 * this.restartAttempts;
        if (this.restartTimer !== undefined) {
            clearTimeout(this.restartTimer);
        }
        this.restartTimer = setTimeout(() => {
            this.restartTimer = undefined;
            void Promise.resolve(this.options.recreateWorker());
        }, delayMs);
    }
}
