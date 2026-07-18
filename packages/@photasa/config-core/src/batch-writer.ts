/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * BatchWriter - 负责批量写入操作的独立模块
 */

import fs from "fs/promises";
import type { PhotasaLogger } from "@photasa/common";
import { FileSystemError, handleError, retryOperation } from "@photasa/common";

interface WriteBatchItem {
    data: string;
    timestamp: number;
}

export class BatchWriter {
    private writeBatch = new Map<string, WriteBatchItem>();
    private writeInterval: NodeJS.Timeout | undefined;
    private readonly intervalMs: number;
    private logger: PhotasaLogger | null = null;

    constructor(intervalMs = 100) {
        this.intervalMs = intervalMs;
    }

    /**
     * 启动批量写入定时器
     */
    start(logger: PhotasaLogger): void {
        if (this.writeInterval) {
            return; // 已经启动
        }

        this.logger = logger;
        this.writeInterval = setInterval(() => {
            this.flush();
        }, this.intervalMs);
    }

    /**
     * 停止批量写入定时器
     */
    stop(): void {
        if (this.writeInterval) {
            clearInterval(this.writeInterval);
            this.writeInterval = undefined;
        }
        // 停止前执行最后一次写入
        this.flush();
        this.logger = null;
    }

    /**
     * 添加写入任务到批处理队列
     */
    addWrite(filePath: string, data: string): void {
        this.writeBatch.set(filePath, { data, timestamp: Date.now() });
    }

    /**
     * 立即刷新所有待写入的数据
     */
    async flush(): Promise<void> {
        if (this.writeBatch.size === 0 || !this.logger) {
            return;
        }

        const batch = Array.from(this.writeBatch.entries());
        this.writeBatch.clear();

        // 按文件路径分组
        const fileGroups = new Map<string, string[]>();
        for (const [filePath, { data }] of batch) {
            if (!fileGroups.has(filePath)) {
                fileGroups.set(filePath, []);
            }
            fileGroups.get(filePath)?.push(data);
        }

        // 并行写入所有文件
        await Promise.all(
            Array.from(fileGroups.entries()).map(async ([filePath, dataArray]) => {
                try {
                    this.logger?.debug(`[BatchWriter] 写入文件: ${filePath}`);
                    await retryOperation(
                        () =>
                            fs.writeFile(filePath, dataArray.join("\n"), {
                                encoding: "utf8",
                                flag: "w",
                            }),
                        3,
                        1000,
                        this.logger!,
                        "BatchWriter.flush",
                    );
                } catch (error) {
                    handleError(
                        new FileSystemError(`Error writing to ${filePath}`, { error }),
                        this.logger!,
                        "BatchWriter.flush",
                    );
                }
            }),
        );
    }

    /**
     * 获取当前待写入的任务数
     */
    get pendingWrites(): number {
        return this.writeBatch.size;
    }

    /**
     * 检查是否正在运行
     */
    get isRunning(): boolean {
        return this.writeInterval !== undefined;
    }
}
