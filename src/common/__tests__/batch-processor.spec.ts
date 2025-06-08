import { BatchProcessor } from "../batch-processor";

describe("BatchProcessor", () => {
    let processor: BatchProcessor<number>;
    const config = {
        chunkSize: 3,
        maxConcurrent: 2,
        rateLimit: 50,
    };

    beforeEach(() => {
        processor = new BatchProcessor(config);
    });

    it("should process items in batches", async () => {
        const items = [1, 2, 3, 4, 5, 6];
        const results: number[] = [];
        const processorFn = async (item: number) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { success: true, data: item * 2 };
        };

        const batchResults = await processor.processBatch(items, processorFn);
        expect(batchResults).toHaveLength(items.length);
        expect(batchResults.every((r) => r.success)).toBe(true);
        expect(batchResults.map((r) => r.data)).toEqual(items.map((i) => i * 2));
    });

    it("should handle errors gracefully", async () => {
        const items = [1, 2, 3];
        const processorFn = async (item: number) => {
            if (item === 2) {
                throw new Error("Test error");
            }
            return { success: true, data: item };
        };

        const batchResults = await processor.processBatch(items, processorFn);
        expect(batchResults).toHaveLength(items.length);
        expect(batchResults[1].success).toBe(false);
        expect(batchResults[1].error).toBeInstanceOf(Error);
    });

    it("should emit progress updates", async () => {
        const items = [1, 2, 3, 4, 5];
        const progressUpdates: any[] = [];

        processor.progress$.subscribe((progress) => {
            progressUpdates.push(progress);
        });

        await processor.processBatch(items, async (item) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { success: true, data: item };
        });

        expect(progressUpdates.length).toBeGreaterThan(0);
        expect(progressUpdates[progressUpdates.length - 1]).toEqual({
            total: items.length,
            completed: items.length,
            failed: 0,
            currentOperation: expect.any(String),
        });
    });

    it("should respect rate limiting", async () => {
        const items = [1, 2, 3, 4];
        const startTime = Date.now();

        await processor.processBatch(items, async (item) => {
            return { success: true, data: item };
        });

        const duration = Date.now() - startTime;
        // Should take at least (items.length - 1) * rateLimit ms
        expect(duration).toBeGreaterThanOrEqual((items.length - 1) * config.rateLimit);
    });

    it("should respect concurrency limits", async () => {
        const items = [1, 2, 3, 4, 5];
        const activeProcesses: number[] = [];
        let maxConcurrent = 0;

        const processorFn = async (item: number) => {
            activeProcesses.push(item);
            maxConcurrent = Math.max(maxConcurrent, activeProcesses.length);
            await new Promise((resolve) => setTimeout(resolve, 50));
            activeProcesses.splice(activeProcesses.indexOf(item), 1);
            return { success: true, data: item };
        };

        await processor.processBatch(items, processorFn);
        expect(maxConcurrent).toBeLessThanOrEqual(config.maxConcurrent);
    });
});
