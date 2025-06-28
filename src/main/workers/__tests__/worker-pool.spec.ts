import { EventEmitter } from "events";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PhotasaLogger } from "@common/logger";
import { WorkerPool } from "../worker-pool";

// Mock Worker class
class MockWorker extends EventEmitter {
    public isBusy = false;
    public postMessage = vi.fn();
    public terminate = vi.fn().mockResolvedValue(undefined);
}

// Mock Worker constructor
vi.mock("worker_threads", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...((typeof actual === "object" && actual) || {}),
        Worker: vi.fn().mockImplementation(() => new MockWorker()),
        default: {
            ...(typeof actual === "object" && actual ? actual : {}),
            Worker: vi.fn().mockImplementation(() => new MockWorker()),
        },
    };
});

describe("WorkerPool", () => {
    let workerPool: WorkerPool;
    const mockLogger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    };

    const config = {
        minWorkers: 2,
        maxWorkers: 4,
        workerScript: "test-worker.js",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        workerPool = new WorkerPool(config, mockLogger as unknown as PhotasaLogger);
    });

    it("should initialize with minimum number of workers", () => {
        expect(workerPool["workers"]).toHaveLength(config.minWorkers);
    });

    it("should process tasks through workers", async () => {
        const task = { type: "test", data: "test-data" };
        const worker = workerPool["workers"][0] as unknown as MockWorker;

        // Simulate worker response
        setTimeout(() => {
            worker.emit("message", { success: true, data: "result" });
        }, 10);

        const resultPromise = new Promise((resolve) => {
            workerPool.on("result", resolve);
        });

        await workerPool.addTask(task);
        const result = await resultPromise;

        expect(worker.postMessage).toHaveBeenCalledWith(task);
        expect(result).toEqual({ success: true, data: "result" });
    });

    it("should handle worker errors", async () => {
        const worker = workerPool["workers"][0] as unknown as MockWorker;
        const error = new Error("Test error");

        worker.emit("error", error);

        expect(mockLogger.error).toHaveBeenCalledWith("Worker error:", error);
        expect(workerPool["workers"]).toHaveLength(config.minWorkers);
    });

    it("should replace workers that exit with non-zero code", async () => {
        const worker = workerPool["workers"][0] as unknown as MockWorker;
        worker.emit("exit", 1);

        expect(mockLogger.warn).toHaveBeenCalledWith("Worker exited with code 1");
        expect(workerPool["workers"]).toHaveLength(config.minWorkers);
    });

    it("should queue tasks when all workers are busy", async () => {
        const tasks = Array(5).fill({ type: "test" });
        const workers = workerPool["workers"] as unknown as MockWorker[];

        // Make all workers busy
        workers.forEach((w) => (w.isBusy = true));

        // Add tasks
        const addPromises = tasks.map((task) => workerPool.addTask(task));

        // Verify tasks are queued
        expect(workerPool["queue"]).toHaveLength(tasks.length);

        // Free up workers
        workers.forEach((w) => {
            w.isBusy = false;
            w.emit("message", { success: true });
        });

        await Promise.all(addPromises);
        expect(workerPool["queue"]).toHaveLength(0);
    });

    it("should shutdown all workers", async () => {
        await workerPool.shutdown();
        const workers = workerPool["workers"] as unknown as MockWorker[];

        expect(workers).toHaveLength(0);
        workers.forEach((w) => {
            expect(w.terminate).toHaveBeenCalled();
        });
    });
});
