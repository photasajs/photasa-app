import { WorkerPool } from "../worker-pool";
import path from "path";
import { EventEmitter } from "events";

// Mock Worker class
class MockWorker extends EventEmitter {
    public isBusy: boolean = false;
    public postMessage = jest.fn();
    public terminate = jest.fn().mockResolvedValue(undefined);
}

// Mock Worker constructor
jest.mock("worker_threads", () => ({
    Worker: jest.fn().mockImplementation(() => new MockWorker()),
}));

describe("WorkerPool", () => {
    let workerPool: WorkerPool;
    const mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
    };

    const config = {
        minWorkers: 2,
        maxWorkers: 4,
        workerScript: "test-worker.js",
    };

    beforeEach(() => {
        jest.clearAllMocks();
        workerPool = new WorkerPool(config, mockLogger as any);
    });

    it("should initialize with minimum number of workers", () => {
        expect(workerPool["workers"]).toHaveLength(config.minWorkers);
    });

    it("should process tasks through workers", async () => {
        const task = { type: "test", data: "test-data" };
        const worker = workerPool["workers"][0] as MockWorker;

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
        const worker = workerPool["workers"][0] as MockWorker;
        const error = new Error("Test error");

        worker.emit("error", error);

        expect(mockLogger.error).toHaveBeenCalledWith("Worker error:", error);
        expect(workerPool["workers"]).toHaveLength(config.minWorkers);
    });

    it("should replace workers that exit with non-zero code", async () => {
        const worker = workerPool["workers"][0] as MockWorker;
        worker.emit("exit", 1);

        expect(mockLogger.warn).toHaveBeenCalledWith("Worker exited with code 1");
        expect(workerPool["workers"]).toHaveLength(config.minWorkers);
    });

    it("should queue tasks when all workers are busy", async () => {
        const tasks = Array(5).fill({ type: "test" });
        const workers = workerPool["workers"] as MockWorker[];

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
        const workers = workerPool["workers"] as MockWorker[];

        expect(workers).toHaveLength(0);
        workers.forEach((w) => {
            expect(w.terminate).toHaveBeenCalled();
        });
    });
});
