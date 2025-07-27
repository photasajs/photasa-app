import { EventEmitter } from "events";
import path from "path";
import fs from "fs-extra";
import {
    FileInfo,
    FileGroup,
    ImportConfig,
    ImportProgress,
    ImportResult,
    ImportError,
} from "../../common/import-types";

/**
 * BatchProcessor handles the processing of multiple files in batches during import
 * It manages concurrency, progress tracking, and error handling
 */
export class BatchProcessor extends EventEmitter {
    private queue: FileInfo[] = [];
    private fileGroups: FileGroup[] = [];
    private activeJobs = 0;
    private maxConcurrency: number;
    private config: ImportConfig;
    private isCancelled = false;
    private isPaused = false;
    private progress: ImportProgress = {
        totalFiles: 0,
        processedFiles: 0,
        currentFile: "",
        speed: 0,
        estimatedTimeRemaining: 0,
        errors: [],
        warnings: [],
        status: "preparing",
    };
    private result: ImportResult = {
        success: true,
        totalFiles: 0,
        successfulFiles: 0,
        skippedFiles: 0,
        errorFiles: 0,
        totalSize: 0,
        importedFiles: [],
        errors: [],
        warnings: [],
        duration: 0,
        importId: `import_${Date.now()}`,
        sourcePaths: [],
        targetPath: "",
    };
    private lastUpdateTime = 0;
    private processedBytesInInterval = 0;

    /**
     * Creates a new BatchProcessor instance
     * @param config Import configuration
     * @param maxConcurrency Maximum number of concurrent file operations
     */
    constructor(config: ImportConfig, maxConcurrency = 4) {
        super();
        this.config = config;
        this.maxConcurrency = maxConcurrency;
        this.result.sourcePaths = config.sourcePaths;
        this.result.targetPath = config.targetPath;
    }

    /**
     * Adds files to the processing queue
     * @param files Array of file actions to process
     */
    addFiles(files: FileInfo[]): void {
        this.queue.push(...files);
        this.progress.totalFiles += files.length;
        this.result.totalFiles += files.length;

        // Calculate total size
        for (const file of files) {
            this.result.totalSize += file.size || 0;
        }

        this.emit("progress", { ...this.progress });
    }

    /**
     * Adds file groups to the processing queue
     * @param groups Array of file groups to process
     */
    addFileGroups(groups: FileGroup[]): void {
        this.fileGroups.push(...groups);

        // Count all files in all groups
        let totalFiles = 0;
        let totalSize = 0;

        for (const group of groups) {
            totalFiles += group.files.length;
            for (const file of group.files) {
                totalSize += file.size || 0;
            }
        }

        this.progress.totalFiles += totalFiles;
        this.result.totalFiles += totalFiles;
        this.result.totalSize += totalSize;

        this.emit("progress", { ...this.progress });
    }

    /**
     * Starts processing the queue
     */
    async start(): Promise<ImportResult> {
        if (this.queue.length === 0 && this.fileGroups.length === 0) {
            return this.result;
        }

        // Process file groups first
        for (const group of this.fileGroups) {
            if (this.isCancelled) break;
            await this.processFileGroup(group);
        }

        // Then process individual files
        const promises: Promise<void>[] = [];

        for (const file of this.queue) {
            if (this.isCancelled) break;

            // Wait if we've reached max concurrency or if paused
            while (this.activeJobs >= this.maxConcurrency || this.isPaused) {
                if (this.isCancelled) break;
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            if (this.isCancelled) break;

            this.activeJobs++;
            const promise = this.processFile(file)
                .catch((error) => {
                    this.handleError(file.path, error);
                })
                .finally(() => {
                    this.activeJobs--;
                });

            promises.push(promise);
        }

        await Promise.all(promises);

        this.result.duration = Date.now() - this.progress.startTime;
        return this.result;
    }

    /**
     * Processes a single file
     * @param file File info to process
     */
    private async processFile(file: FileInfo): Promise<void> {
        try {
            this.progress.currentFile = path.basename(file.path);
            this.emit("progress", { ...this.progress });

            // Ensure target directory exists
            await fs.ensureDir(path.dirname(file.targetFullPath));

            // Copy the file
            await fs.copy(file.path, file.targetFullPath);

            // Update progress
            this.progress.processedFiles++;
            this.result.successfulFiles++;
            this.updateSpeed(file.size || 0);

            this.emit("progress", { ...this.progress });
            this.emit("fileProcessed", {
                sourcePath: file.path,
                targetPath: file.targetFullPath,
                success: true,
            });
        } catch (error) {
            this.progress.processedFiles++;
            this.result.errorFiles++;
            this.handleError(file.path, error);
            throw error;
        }
    }

    /**
     * Processes a file group as a single unit
     * @param group File group to process
     */
    private async processFileGroup(group: FileGroup): Promise<void> {
        try {
            // Process main file first
            const mainFile = group.mainFile;
            this.progress.currentFile = path.basename(mainFile.path);
            this.emit("progress", { ...this.progress });

            // Ensure all target directories exist
            for (const file of group.files) {
                await fs.ensureDir(path.dirname(file.targetFullPath));
            }

            // Copy all files in the group
            for (const file of group.files) {
                if (this.isCancelled) break;

                await fs.copy(file.path, file.targetFullPath);

                // Update progress for each file
                this.progress.processedFiles++;
                this.result.successfulFiles++;
                this.updateSpeed(file.size || 0);

                this.emit("progress", { ...this.progress });
            }

            this.emit("groupProcessed", {
                groupId: `group_${Date.now()}`,
                mainFile: mainFile.path,
                success: true,
            });
        } catch (error) {
            // Mark all files in the group as failed
            for (const file of group.files) {
                this.progress.processedFiles++;
                this.result.errorFiles++;
            }

            this.handleError(group.files[0].path, error);
            throw error;
        }
    }

    /**
     * Updates the processing speed and estimated remaining time
     * @param processedBytes Number of bytes processed
     */
    private updateSpeed(processedBytes: number): void {
        const now = Date.now();
        this.result.processedSize += processedBytes;
        this.processedBytesInInterval += processedBytes;

        // Update speed calculation every second
        if (now - this.lastUpdateTime >= 1000) {
            const elapsedSeconds = (now - this.lastUpdateTime) / 1000;
            this.progress.speed = this.processedBytesInInterval / elapsedSeconds;

            // Calculate remaining time
            const remainingBytes = this.result.totalSize - this.result.processedSize;
            if (this.progress.speed > 0) {
                this.progress.remainingTime = remainingBytes / this.progress.speed;
            }

            this.lastUpdateTime = now;
            this.processedBytesInInterval = 0;
        }
    }

    /**
     * Handles errors during processing
     * @param filePath Path of the file that caused the error
     * @param error Error object
     */
    private handleError(filePath: string, error: any): void {
        const errorInfo: ImportError = {
            file: filePath,
            error: error.message || "Unknown error",
            code: error.code,
            recoverable: false,
        };

        this.progress.errors.push(errorInfo);
        this.result.errors.push(errorInfo);

        this.emit("error", {
            file: filePath,
            error: error,
        });

        this.emit("progress", { ...this.progress });
    }

    /**
     * Pauses the processing
     */
    pause(): void {
        this.isPaused = true;
        this.emit("paused");
    }

    /**
     * Resumes the processing
     */
    resume(): void {
        this.isPaused = false;
        this.emit("resumed");
    }

    /**
     * Cancels the processing
     */
    cancel(): void {
        this.isCancelled = true;
        this.emit("cancelled");
    }

    /**
     * Gets the current progress
     */
    getProgress(): ImportProgress {
        return { ...this.progress };
    }

    /**
     * Gets the current result
     */
    getResult(): ImportResult {
        return { ...this.result };
    }

    /**
     * Adjusts the concurrency level dynamically
     * @param maxConcurrency New maximum concurrency value
     */
    setMaxConcurrency(maxConcurrency: number): void {
        this.maxConcurrency = Math.max(1, maxConcurrency);
    }
}
