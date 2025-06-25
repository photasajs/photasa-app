import { Worker } from "worker_threads";
import { EventEmitter } from "events";
import { PhotasaLogger } from "@common/logger";

interface BusyWorker extends Worker {
    isBusy: boolean;
}

export interface WorkerPoolConfig {
    minWorkers: number;
    maxWorkers: number;
    workerScript?: string;
    createWorker?: (options?: unknown) => Worker;
}

export class WorkerPool extends EventEmitter {
    private workers: BusyWorker[] = [];
    private queue: unknown[] = [];
    private config: WorkerPoolConfig;
    private logger: Logger;

    constructor(config: WorkerPoolConfig, logger: PhotasaLogger) {
        super();
        this.config = config;
        this.logger = logger;
        this.initializeWorkers();
    }

    private initializeWorkers(): void {
        for (let i = 0; i < this.config.minWorkers; i++) {
            this.createWorker();
        }
    }

    private createWorker(): BusyWorker {
        let worker: BusyWorker;
        if (this.config.createWorker) {
            worker = this.config.createWorker() as BusyWorker;
        } else if (this.config.workerScript) {
            worker = new Worker(this.config.workerScript) as BusyWorker;
        } else {
            throw new Error("WorkerPoolConfig must provide either createWorker or workerScript");
        }
        worker.isBusy = false;

        worker.on("message", (result) => {
            this.emit("result", result);
            this.processNextTask(worker);
        });

        worker.on("error", (error) => {
            this.logger.error("Worker error:", error);
            this.emit("error", error);
            this.replaceWorker(worker);
        });

        worker.on("exit", (code) => {
            if (code !== 0) {
                this.logger.warn(`Worker exited with code ${code}`);
                this.replaceWorker(worker);
            }
        });

        this.workers.push(worker);
        return worker;
    }

    private replaceWorker(worker: BusyWorker): void {
        const index = this.workers.indexOf(worker);
        if (index !== -1) {
            this.workers.splice(index, 1);
            this.createWorker();
        }
    }

    public async addTask(task: unknown): Promise<void> {
        return new Promise((resolve) => {
            this.queue.push({ task, resolve });
            this.processQueue();
        });
    }

    private processQueue(): void {
        const availableWorker = this.workers.find((w) => !w.isBusy);
        if (availableWorker && this.queue.length > 0) {
            const { task, resolve } = this.queue.shift();
            availableWorker.isBusy = true;
            availableWorker.postMessage(task);
            resolve();
        }
    }

    private processNextTask(worker: BusyWorker): void {
        worker.isBusy = false;
        this.processQueue();
    }

    public async shutdown(): Promise<void> {
        const promises = this.workers.map((worker) => worker.terminate());
        await Promise.all(promises);
        this.workers = [];
        this.queue = [];
    }
}
