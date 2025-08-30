import createWorker from "./import-worker?nodeWorker";
import type { IpcMain } from "electron";
import { dialog } from "electron";
import type { WorkerResponse } from "@common/types";
import { sendWorkerTask, onWorkerResponse, Worker } from "@common/worker-util";
import { getLogger } from "@common/logger";
import { importHistoryManager } from "./history-manager";
import type {
    ImportRequest,
    ImportResponse,
    ImportConfig,
    ImportPreview,
    ImportResult,
    ImportProgress,
    ImportHistory,
    UndoResult,
    FileGroup,
    ImportFilters,
    MetadataRequest,
    FileMetadata,
    ScanDirectoriesRequest,
    ImportSession,
    EnhancedImportCallback,
} from "@common/import-types";

/**
 * 导入 worker 类型
 */
type ImportWorker = Worker<ImportRequest, ImportResponse>;

/**
 * 导入服务 - 管理照片导入的主要服务
 */
export default class ImportService {
    private ipc: IpcMain;
    private worker: ImportWorker;
    private logger = getLogger("import");

    // 活跃的导入会话
    private activeSessions = new Map<string, ImportSession>();

    // 导入进度回调
    private progressCallbacks = new Map<string, EnhancedImportCallback>();

    constructor(
        ipcMain: IpcMain,
        private mainWindow?: Electron.BrowserWindow,
    ) {
        this.ipc = ipcMain;
        this.logger.info("ImportService: Creating import service...");
        this.logger.info(`ImportService: mainWindow provided: ${!!mainWindow}`);

        // 创建 worker
        this.worker = createWorker({ workerData: "worker" });

        // 处理 worker 消息
        this.worker.on("message", (message: WorkerResponse<ImportResponse>) => {
            this.logger.debug("Received message from import worker:", message);
            onWorkerResponse<ImportResponse>(message);
        });

        // 注册IPC处理器
        this.setupIpcHandlers();

        this.logger.info("Import service initialized");
    }

    /**
     * 设置IPC处理器
     */
    private setupIpcHandlers(): void {
        this.logger.info("[import-service] Setting up IPC handlers...");
        // 扫描源目录
        this.ipc.handle(
            "import:scan-directories",
            async (_, paths: string[], filters?: ImportFilters) => {
                this.logger.info(
                    `[import-service] Scan directories: ${paths?.join(", ") || "无路径"}`,
                );
                return await this.scanDirectories(paths, filters);
            },
        );

        // 预览导入
        this.ipc.handle("import:preview", async (_, config: ImportConfig) => {
            this.logger.info(
                `[import-service] Preview import from: ${config.sourcePaths?.join(", ") || "无源路径"}`,
            );
            return await this.previewImport(config);
        });

        // 执行导入
        this.ipc.handle(
            "import:execute",
            async (_, config: ImportConfig, callback?: EnhancedImportCallback) => {
                this.logger.info(
                    `[import-service] Execute import from: ${config.sourcePaths?.join(", ") || "无源路径"}`,
                );
                return await this.executeImport(config, callback);
            },
        );

        // 取消导入
        this.ipc.handle("import:cancel", async (_, importId: string) => {
            this.logger.info(`[import-service] Cancel import: ${importId}`);
            return await this.cancelImport(importId);
        });

        // 暂停导入
        this.ipc.handle("import:pause", async (_, importId: string) => {
            this.logger.info(`[import-service] Pause import: ${importId}`);
            return await this.pauseImport(importId);
        });

        // 恢复导入
        this.ipc.handle("import:resume", async (_, importId: string) => {
            this.logger.info(`[import-service] Resume import: ${importId}`);
            return await this.resumeImport(importId);
        });

        // 获取导入进度
        this.ipc.handle("import:get-progress", async (_, importId: string) => {
            return await this.getImportProgress(importId);
        });

        // 获取导入历史
        this.ipc.handle("import:get-history", async (_, limit?: number) => {
            this.logger.info(`[import-service] Get import history (limit: ${limit})`);
            return await this.getImportHistory(limit);
        });

        // 获取导入详情
        this.ipc.handle("import:get-details", async (_, historyId: string) => {
            this.logger.info(`[import-service] Get import details: ${historyId}`);
            return await this.getImportDetails(historyId);
        });

        // 预览撤销操作
        this.ipc.handle("import:preview-undo", async (_, historyId: string) => {
            this.logger.info(`[import-service] Preview undo import: ${historyId}`);
            return await this.previewUndo(historyId);
        });

        // 撤销导入
        this.ipc.handle("import:undo", async (_, historyId: string) => {
            this.logger.info(`[import-service] Undo import: ${historyId}`);
            return await this.undoImport(historyId);
        });

        // 选择多个目录
        this.ipc.handle("import:choose-directories", async (_, multiSelect = true) => {
            this.logger.info(`[import-service] Choose directories (multiSelect: ${multiSelect})`);
            this.logger.info(`[import-service] mainWindow exists: ${!!this.mainWindow}`);
            return await this.chooseDirectories(multiSelect);
        });

        // 提取元数据
        this.ipc.handle("import:extract-metadata", async (_, request: MetadataRequest) => {
            this.logger.info(`[import-service] Extract metadata: ${request.filePath}`);
            return await this.extractMetadata(request);
        });
    }

    /**
     * 扫描多个源目录，获取文件组信息
     */
    private async scanDirectories(paths: string[], filters?: ImportFilters): Promise<FileGroup[]> {
        this.logger.info(`[import-service] Scanning directories: ${paths?.join(", ") || "无路径"}`);

        try {
            const request: ScanDirectoriesRequest = { paths, filters };
            const response = await sendWorkerTask<ImportWorker, ImportRequest, ImportResponse>(
                this.worker,
                "scan_directories",
                { action: "scan_directories", payload: request },
            );

            if (!response.success || !response.data) {
                throw new Error(response.error || "Failed to scan directories");
            }

            const result = response.data as FileGroup[];
            this.logger.info(`[import-service] Scan completed: found ${result.length} file groups`);
            return result;
        } catch (error) {
            this.logger.error(`[import-service] Scan directories failed: ${error}`);
            throw error;
        }
    }

    /**
     * 预览导入操作，不实际执行导入
     */
    private async previewImport(config: ImportConfig): Promise<ImportPreview> {
        this.logger.info(`[import-service] Generating import preview`);

        // 验证配置
        if (!config.sourcePaths || !Array.isArray(config.sourcePaths)) {
            this.logger.error(
                `[import-service] Invalid sourcePaths: ${typeof config.sourcePaths}, value: ${JSON.stringify(config.sourcePaths)}`,
            );
            throw new Error("sourcePaths must be a non-empty array");
        }

        if (config.sourcePaths.length === 0) {
            this.logger.warn(`[import-service] Empty sourcePaths array`);
            throw new Error("sourcePaths cannot be empty");
        }

        try {
            // 序列化配置中的日期对象
            const serializableConfig = {
                ...config,
                filters: {
                    ...config.filters,
                    dateRange: {
                        start: config.filters.dateRange.start instanceof Date 
                            ? config.filters.dateRange.start.toISOString()
                            : config.filters.dateRange.start,
                        end: config.filters.dateRange.end instanceof Date 
                            ? config.filters.dateRange.end.toISOString()
                            : config.filters.dateRange.end
                    }
                }
            };
            
            const response = await sendWorkerTask<ImportWorker, ImportRequest, ImportResponse>(
                this.worker,
                "preview_import",
                { action: "preview_import", payload: serializableConfig as any },
            );

            if (!response.success || !response.data) {
                throw new Error(response.error || "Failed to generate import preview");
            }

            const result = response.data as ImportPreview;
            this.logger.info(
                `[import-service] Preview generated: ${result.statistics.totalFiles} files`,
            );
            return result;
        } catch (error) {
            this.logger.error(`[import-service] Preview import failed: ${error}`);
            throw error;
        }
    }

    /**
     * 执行导入操作
     */
    private async executeImport(
        config: ImportConfig,
        callback?: EnhancedImportCallback,
    ): Promise<ImportResult> {
        this.logger.info(`[import-service] Starting import execution`);

        try {
            // 如果提供了回调，存储它
            if (callback) {
                // 这里需要一个导入ID，实际实现中应该从config或生成
                const importId = `import_${Date.now()}`;
                this.progressCallbacks.set(importId, callback);
            }

            // 序列化配置中的日期对象，以便通过 Worker 传递
            const serializableConfig = {
                ...config,
                filters: {
                    ...config.filters,
                    dateRange: {
                        start: config.filters.dateRange.start instanceof Date 
                            ? config.filters.dateRange.start.toISOString()
                            : config.filters.dateRange.start,
                        end: config.filters.dateRange.end instanceof Date 
                            ? config.filters.dateRange.end.toISOString()
                            : config.filters.dateRange.end
                    }
                }
            };

            const response = await sendWorkerTask<ImportWorker, ImportRequest, ImportResponse>(
                this.worker,
                "execute_import",
                { action: "execute_import", payload: serializableConfig as any },
            );

            if (!response.success || !response.data) {
                throw new Error(response.error || "Failed to execute import");
            }

            const result = response.data as ImportResult;
            this.logger.info(
                `[import-service] Import completed: ${result.successfulFiles}/${result.totalFiles} files imported`,
            );

            // 记录导入历史
            await this.recordImportHistory(result);

            return result;
        } catch (error) {
            this.logger.error(`[import-service] Execute import failed: ${error}`);
            throw error;
        }
    }

    /**
     * 取消正在进行的导入操作
     */
    private async cancelImport(importId: string): Promise<boolean> {
        this.logger.info(`[import-service] Cancelling import: ${importId}`);

        try {
            const session = this.activeSessions.get(importId);
            if (session) {
                session.status = "cancelled";
                session.cancelTime = new Date();
                this.activeSessions.set(importId, session);

                // 清理回调
                this.progressCallbacks.delete(importId);

                this.logger.info(`[import-service] Import cancelled: ${importId}`);
                return true;
            }

            this.logger.warn(`[import-service] Import session not found: ${importId}`);
            return false;
        } catch (error) {
            this.logger.error(`[import-service] Cancel import failed: ${error}`);
            return false;
        }
    }

    /**
     * 暂停正在进行的导入操作
     */
    private async pauseImport(importId: string): Promise<boolean> {
        this.logger.info(`[import-service] Pausing import: ${importId}`);

        try {
            const session = this.activeSessions.get(importId);
            if (session && session.status === "processing") {
                session.status = "paused";
                session.pauseTime = new Date();
                this.activeSessions.set(importId, session);

                this.logger.info(`[import-service] Import paused: ${importId}`);
                return true;
            }

            this.logger.warn(
                `[import-service] Cannot pause import: ${importId} (not found or not processing)`,
            );
            return false;
        } catch (error) {
            this.logger.error(`[import-service] Pause import failed: ${error}`);
            return false;
        }
    }

    /**
     * 恢复暂停的导入操作
     */
    private async resumeImport(importId: string): Promise<ImportResult> {
        this.logger.info(`[import-service] Resuming import: ${importId}`);

        try {
            const session = this.activeSessions.get(importId);
            if (session && session.status === "paused") {
                session.status = "processing";
                session.resumeCount = (session.resumeCount || 0) + 1;
                session.lastResumeTime = new Date();
                this.activeSessions.set(importId, session);

                // 继续执行导入
                const result = await this.executeImport(session.config);

                this.logger.info(`[import-service] Import resumed and completed: ${importId}`);
                return result;
            }

            throw new Error(`Cannot resume import: ${importId} (not found or not paused)`);
        } catch (error) {
            this.logger.error(`[import-service] Resume import failed: ${error}`);
            throw error;
        }
    }

    /**
     * 获取导入进度信息
     */
    private async getImportProgress(importId: string): Promise<ImportProgress> {
        this.logger.debug(`[import-service] Getting import progress: ${importId}`);

        try {
            const session = this.activeSessions.get(importId);
            if (session) {
                return session.progress;
            }

            // 如果会话不存在，返回默认进度
            return {
                totalFiles: 0,
                processedFiles: 0,
                speed: 0,
                estimatedTimeRemaining: 0,
                errors: [],
                warnings: [],
                status: "completed",
            };
        } catch (error) {
            this.logger.error(`[import-service] Get import progress failed: ${error}`);
            throw error;
        }
    }

    /**
     * 获取导入历史记录
     */
    private async getImportHistory(limit?: number): Promise<ImportHistory[]> {
        this.logger.info(`[import-service] Getting import history (limit: ${limit})`);

        try {
            return await importHistoryManager.getHistory(limit);
        } catch (error) {
            this.logger.error(`[import-service] Get import history failed: ${error}`);
            throw error;
        }
    }

    /**
     * 获取导入详情
     */
    private async getImportDetails(historyId: string): Promise<ImportHistory | null> {
        this.logger.info(`[import-service] Getting import details: ${historyId}`);

        try {
            return await importHistoryManager.getImportDetails(historyId);
        } catch (error) {
            this.logger.error(`[import-service] Get import details failed: ${error}`);
            throw error;
        }
    }

    /**
     * 预览撤销操作
     */
    private async previewUndo(historyId: string): Promise<any> {
        this.logger.info(`[import-service] Previewing undo for import: ${historyId}`);

        try {
            return await importHistoryManager.previewUndo(historyId);
        } catch (error) {
            this.logger.error(`[import-service] Preview undo failed: ${error}`);
            throw error;
        }
    }

    /**
     * 撤销指定的导入操作
     */
    private async undoImport(historyId: string): Promise<UndoResult> {
        this.logger.info(`[import-service] Undoing import: ${historyId}`);

        try {
            return await importHistoryManager.undoImport(historyId);
        } catch (error) {
            this.logger.error(`[import-service] Undo import failed: ${error}`);
            throw error;
        }
    }

    /**
     * 选择多个目录
     */
    private async chooseDirectories(multiSelect = true): Promise<{ filePaths: string[] }> {
        this.logger.info(`[import-service] Choosing directories (multiSelect: ${multiSelect})`);

        try {
            this.logger.info("[import-service] 准备显示目录选择对话框...");
            const result = await dialog.showOpenDialog(this.mainWindow || undefined, {
                properties: multiSelect ? ["openDirectory", "multiSelections"] : ["openDirectory"],
                title: multiSelect ? "Select Source Directories" : "Select Target Directory",
            });

            this.logger.info(
                `[import-service] 对话框结果: canceled=${result.canceled}, paths=${result.filePaths?.length || 0}`,
            );

            if (result.canceled) {
                this.logger.info("[import-service] 用户取消了对话框");
                return { filePaths: [] };
            }

            this.logger.info(
                `[import-service] Selected directories: ${result.filePaths?.join(", ") || "无路径"}`,
            );
            return { filePaths: result.filePaths };
        } catch (error) {
            this.logger.error(`[import-service] Choose directories failed: ${error}`);
            throw error;
        }
    }

    /**
     * 提取文件元数据
     */
    private async extractMetadata(request: MetadataRequest): Promise<FileMetadata> {
        this.logger.debug(`[import-service] Extracting metadata: ${request.filePath}`);

        try {
            const response = await sendWorkerTask<ImportWorker, ImportRequest, ImportResponse>(
                this.worker,
                "extract_metadata",
                { action: "extract_metadata", payload: request },
            );

            if (!response.success || !response.data) {
                throw new Error(response.error || "Failed to extract metadata");
            }

            const result = response.data as FileMetadata;
            this.logger.debug(`[import-service] Metadata extracted: ${result.dateSource}`);
            return result;
        } catch (error) {
            this.logger.error(`[import-service] Extract metadata failed: ${error}`);
            throw error;
        }
    }

    /**
     * 记录导入历史
     */
    private async recordImportHistory(result: ImportResult): Promise<void> {
        this.logger.debug(`[import-service] Recording import history: ${result.importId}`);

        try {
            await importHistoryManager.recordImport(result);
            this.logger.info(`[import-service] Import history recorded: ${result.importId}`);
        } catch (error) {
            this.logger.error(`[import-service] Record import history failed: ${error}`);
            // 不抛出错误，因为这不应该影响导入结果
        }
    }

    /**
     * 清理资源
     */
    public async cleanup(): Promise<void> {
        this.logger.info("[import-service] Cleaning up import service");

        try {
            // 取消所有活跃的导入会话
            for (const [importId, session] of this.activeSessions) {
                if (session.status === "processing") {
                    await this.cancelImport(importId);
                }
            }

            // 清理回调
            this.progressCallbacks.clear();
            this.activeSessions.clear();

            // 终止worker
            if (this.worker) {
                this.worker.terminate();
            }

            this.logger.info("[import-service] Import service cleanup completed");
        } catch (error) {
            this.logger.error(`[import-service] Cleanup failed: ${error}`);
        }
    }

    /**
     * 获取服务状态
     */
    public getServiceStatus(): {
        activeSessions: number;
        activeCallbacks: number;
        workerStatus: string;
    } {
        return {
            activeSessions: this.activeSessions.size,
            activeCallbacks: this.progressCallbacks.size,
            workerStatus: this.worker ? "active" : "inactive",
        };
    }
}
