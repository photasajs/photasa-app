import { Observable, Subject } from "rxjs";

export interface BatchConfig {
    chunkSize: number;
    maxConcurrent: number;
    rateLimit: number;
}

export interface BatchProgress {
    total: number;
    completed: number;
    failed: number;
    currentOperation: string;
}

export interface BatchResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
}

export class BatchProcessor<T> {
    private progressSubject = new Subject<BatchProgress>();
    private config: BatchConfig;
    private totalItems: number = 0;
    private completedItems: number = 0;
    private failedItems: number = 0;

    constructor(config: BatchConfig) {
        this.config = {
            chunkSize: config.chunkSize || 10,
            maxConcurrent: config.maxConcurrent || 3,
            rateLimit: config.rateLimit || 100,
        };
    }

    public get progress$(): Observable<BatchProgress> {
        return this.progressSubject.asObservable();
    }

    public async processBatch(
        items: T[],
        processor: (item: T) => Promise<BatchResult<T>>,
    ): Promise<BatchResult<T>[]> {
        this.totalItems = items.length;
        this.completedItems = 0;
        this.failedItems = 0;

        const results: BatchResult<T>[] = [];

        // Create chunks of items
        const chunks = this.createChunks(items, this.config.chunkSize);

        for (const chunk of chunks) {
            // Process chunk with concurrency control
            const chunkResults = await this.processChunk(chunk, processor);
            results.push(...chunkResults);

            // Rate limiting between chunks
            if (this.config.rateLimit > 0) {
                await new Promise((resolve) => setTimeout(resolve, this.config.rateLimit));
            }
        }

        return results;
    }

    private createChunks<T>(items: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < items.length; i += chunkSize) {
            chunks.push(items.slice(i, i + chunkSize));
        }
        return chunks;
    }

    private async processChunk<T>(
        chunk: T[],
        processor: (item: T) => Promise<BatchResult<T>>,
    ): Promise<BatchResult<T>[]> {
        const results: BatchResult<T>[] = [];
        const promises: Promise<void>[] = [];

        // Process items with concurrency control
        for (let i = 0; i < chunk.length; i += this.config.maxConcurrent) {
            const batch = chunk.slice(i, i + this.config.maxConcurrent);
            const batchPromises = batch.map(async (item) => {
                try {
                    const result = await processor(item);
                    results.push(result);
                    this.completedItems++;
                    if (!result.success) {
                        this.failedItems++;
                    }
                } catch (error) {
                    results.push({ success: false, error: error as Error });
                    this.completedItems++;
                    this.failedItems++;
                }
                this.updateProgress();
            });
            promises.push(...batchPromises);
        }

        await Promise.all(promises);
        return results;
    }

    private updateProgress(): void {
        this.progressSubject.next({
            total: this.totalItems,
            completed: this.completedItems,
            failed: this.failedItems,
            currentOperation: `Processing items (${this.completedItems}/${this.totalItems})`,
        });
    }
}
