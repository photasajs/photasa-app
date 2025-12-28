import { EventEmitter } from "events";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PhotasaLogger } from "@photasa/common";
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
    let workerPool: WorkerPool<any, any>;
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

    it("should shutdown all workers", async () => {
        await workerPool.shutdown();
        const workers = workerPool["workers"] as unknown as MockWorker[];

        expect(workers).toHaveLength(0);
        workers.forEach((w) => {
            expect(w.terminate).toHaveBeenCalled();
        });
    });
});
