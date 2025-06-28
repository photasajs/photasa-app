import { onWorkerResponse, sendWorkerTask, Worker } from "@common/worker-util";
import { Worker as NodeWorker } from "worker_threads";
import type { PhotasaLogger } from "@common/logger";
import type { WorkerResponse } from "@common/types";

interface Task<T, R> {
    action: string;
    payload: T;
    resolve: (value: R) => void;
    reject: (reason?: any) => void;
}
interface BusyWorker<T, R> extends Worker<T, R> {
    isBusy: boolean;
    currentTask: Task<T, R> | undefined;
}

export interface WorkerPoolConfig {
    minWorkers: number;
    maxWorkers: number;
    workerScript?: string;
    createWorker?: (options?: unknown) => NodeWorker;
}

/**
 * 通用 WorkerPool，支持并发池调度与统一 worker 通信协议
 */
export class WorkerPool<T, R> {
    private workers: BusyWorker<T, R>[] = [];
    private queue: Task<T, R>[] = [];
    private config: WorkerPoolConfig;
    private logger: PhotasaLogger;

    constructor(config: WorkerPoolConfig, logger: PhotasaLogger) {
        this.config = config;
        this.logger = logger;
        this.initializeWorkers();
    }

    private initializeWorkers(): void {
        for (let i = 0; i < this.config.minWorkers; i++) {
            this.createWorker();
        }
    }

    private createWorker(): BusyWorker<T, R> {
        let worker: BusyWorker<T, R>;
        if (this.config.createWorker) {
            this.logger.debug(`[createWorker] 创建工作: ${this.config.createWorker}`);
            worker = this.config.createWorker() as unknown as BusyWorker<T, R>;
        } else if (this.config.workerScript) {
            this.logger.debug(`[createWorker] 创建工作: ${this.config.workerScript}`);
            worker = new NodeWorker(this.config.workerScript) as unknown as BusyWorker<T, R>;
        } else {
            this.logger.error(`[createWorker] 创建工作失败: ${this.config.workerScript}`);
            throw new Error("WorkerPoolConfig must provide either createWorker or workerScript");
        }
        worker.isBusy = false;

        // 处理消息
        worker.on("message", (result: WorkerResponse<R>) => {
            this.logger.debug(`[createWorker] 处理消息: ${JSON.stringify(result)}`);
            // 处理消息，onWorkerResponse 会自动 resolve 或 reject 当前任务
            onWorkerResponse<R>(result);
        });

        // 处理错误
        worker.on("error", (error) => {
            this.logger.debug(`[createWorker] 处理错误: ${JSON.stringify(error)}`);
            this.logger.error("Worker error:", error);
            // 错误时，reject 当前任务
            worker.currentTask?.reject(error);
            this.replaceWorker(worker);
        });

        // 处理退出
        worker.on("exit", (code: any) => {
            this.logger.debug(`[createWorker] 处理退出: ${code}`);
            // 退出时，reject 当前任务
            worker.currentTask?.reject(code);
            if (code !== 0) {
                this.logger.warn(`Worker exited with code ${code}`);
                this.replaceWorker(worker);
            }
        });

        this.workers.push(worker);
        return worker;
    }

    private replaceWorker(worker: BusyWorker<T, R>): void {
        this.logger.debug(`[replaceWorker] 替换工作: ${worker}`);
        const index = this.workers.indexOf(worker);
        if (index !== -1) {
            this.workers.splice(index, 1);
            this.createWorker();
        }
    }

    /**
     * 添加任务到 worker 池，自动分配空闲 worker，采用统一协议
     * @param task WorkerMessage<T>
     * @returns Promise<R>
     */
    public async addTask(action: string, payload: T): Promise<R> {
        this.logger.debug(`[addTask] 添加任务: ${action}`);
        return new Promise<R>((resolve, reject) => {
            this.queue.push({ action, payload, resolve, reject });
            this.processQueue();
        });
    }

    /**
     * 处理任务队列，分配空闲 worker
     */
    private processQueue(): void {
        this.logger.debug(`[processQueue] 处理队列: ${this.queue.length}`);
        const availableWorker = this.workers.find((w) => !w.isBusy);
        if (availableWorker && this.queue.length > 0) {
            const currentTask = this.queue.shift() as Task<T, R>;
            availableWorker.isBusy = true;
            availableWorker.currentTask = currentTask;
            const { action, payload, resolve, reject } = currentTask;
            this.logger.debug(`[processQueue] 发送任务: ${action} ${JSON.stringify(payload)}`);
            // 通过 sendWorkerTask 发送任务，采用统一协议
            sendWorkerTask<Worker<T, R>, T, R>(availableWorker, action, payload)
                .then((result) => {
                    // sendWorkerTask 会自动处理结果，pending the promise
                    // 在调用 onWorkerResponse 时，会自动 resolve 或 reject 这个 promise
                    this.logger.debug(`[processQueue] 发送任务成功: ${JSON.stringify(result)}`);
                    resolve(result);
                })
                .catch((err) => {
                    this.logger.error(`[processQueue] 发送任务失败: ${JSON.stringify(err)}`);
                    reject(err);
                })
                .finally(() => {
                    this.processNextTask(availableWorker);
                });
        }
    }

    private processNextTask(worker: BusyWorker<T, R>): void {
        worker.isBusy = false;
        worker.currentTask = undefined;
        this.processQueue();
    }

    public async shutdown(): Promise<void> {
        this.logger.debug(`[shutdown] 关闭工作池`);
        const promises = this.workers.map((worker) => worker.terminate());
        await Promise.all(promises);
        this.workers = [];
        this.queue = [];
    }
}
