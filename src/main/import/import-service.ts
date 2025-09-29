import createWorker from "./import-worker?nodeWorker";
import type { IpcMain } from "electron";
import { dialog, app } from "electron";
import { getAppPath } from "@shared/path-util";
import type { WorkerResponse } from "@common/types";
import {
    sendWorkerTask,
    onWorkerResponse,
    onPreviewProgressEvent,
    Worker,
    type ProgressEvent,
    type PreviewProgressEvent,
} from "@common/worker-util";
import { loggers } from "@common/logger";
import { ImportEvents } from "@common/constants";
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
import { Service } from "@main/tianting/decorators/service-decorators";
import { ServicePriority, IService } from "@main/tianting/core/service-types";

/**
 * 导入 worker 类型
 */
type ImportWorker = Worker<ImportRequest, ImportResponse>;

const logger = loggers.import;
/**
 * 导入服务 - 管理照片导入的主要服务
 */
@Service({
    name: "import",
    displayName: "导入服务",
    priority: ServicePriority.Critical,
    startupDelay: 0,
    lazyLoad: false,
    description: "处理照片导入操作",
})
export default class ImportService implements IService {
    readonly name = "import";
    private ipc: IpcMain;
    private worker: ImportWorker;

    // 活跃的导入会话
    private activeSessions = new Map<string, ImportSession>();

    // 导入进度回调
    private progressCallbacks = new Map<string, EnhancedImportCallback>();

    constructor(
        ipcMain: IpcMain,
        private mainWindow?: Electron.BrowserWindow,
    ) {
        this.ipc = ipcMain;
        logger.info("ImportService: Creating import service...");
        logger.info(`ImportService: mainWindow provided: ${!!mainWindow}`);

        // 创建 worker，传递应用路径
        this.worker = createWorker({
            workerData: "worker",
            env: {
                ...process.env,
                APP_PATH: getAppPath(app),
            },
        });

        // 处理 worker 消息
        this.worker.on(
            "message",
            (message: WorkerResponse<ImportResponse> | ProgressEvent | PreviewProgressEvent) => {
                logger.debug("Received message from import worker:", message);

                // 检查消息类型
                if ((message as ProgressEvent).type === "progress") {
                    this.handleProgressEvent(message as ProgressEvent);
                } else if ((message as PreviewProgressEvent).type === "preview_progress") {
                    onPreviewProgressEvent(message as PreviewProgressEvent);
                } else {
                    onWorkerResponse<ImportResponse>(message as WorkerResponse<ImportResponse>);
                }
            },
        );

        logger.info("Import service worker and listeners initialized");
    }

    /**
     * 初始化导入服务
     */
    async initialize(): Promise<void> {
        // 注册IPC处理器
        this.setupIpcHandlers();

        logger.info("[ImportService] 导入服务已初始化");
    }

    /**
     * 处理worker的进度事件
     */
    private handleProgressEvent(progressEvent: ProgressEvent): void {
        const { taskId, data } = progressEvent;
        logger.debug(`[import-service] Progress event for task ${taskId}:`, data);

        // 查找对应的导入会话
        const session = this.activeSessions.get(taskId);
        if (session) {
            // 更新会话进度
            session.progress = {
                ...session.progress,
                processedFiles: data.processedFiles,
                totalFiles: data.totalFiles,
                currentFile: data.currentFile,
                speed: data.speed,
                estimatedTimeRemaining: data.estimatedTimeRemaining,
                remainingTime: data.estimatedTimeRemaining,
            };

            // 转发进度事件到renderer
            this.sendImportEvent(taskId, ImportEvents.PROGRESS, {
                progress: session.progress,
            });
        }
    }

    /**
     * 设置IPC处理器
     */
    private setupIpcHandlers(): void {
        logger.info("[import-service] Setting up IPC handlers...");
        // 扫描源目录
        this.ipc.handle(
            ImportEvents.SCAN_DIRECTORIES,
            async (_, paths: string[], filters?: ImportFilters) => {
                logger.info(`[import-service] Scan directories: ${paths?.join(", ") || "无路径"}`);
                return await this.scanDirectories(paths, filters);
            },
        );

        // 预览导入
        this.ipc.handle(ImportEvents.PREVIEW, async (_, config: ImportConfig) => {
            logger.info(
                `[import-service] Preview import from: ${config.sourcePaths?.join(", ") || "无源路径"}`,
            );
            return await this.previewImport(config);
        });

        // 执行导入（新的事件驱动模式）
        this.ipc.handle(
            ImportEvents.EXECUTE,
            async (_, config: ImportConfig & { importId?: string }) => {
                logger.info(
                    `[import-service] Execute import from: ${config.sourcePaths?.join(", ") || "无源路径"}`,
                );
                return await this.startImport(config);
            },
        );

        // 取消导入
        this.ipc.handle(ImportEvents.CANCEL, async (_, importId: string) => {
            logger.info(`[import-service] Cancel import: ${importId}`);
            return await this.cancelImport(importId);
        });

        // 暂停导入
        this.ipc.handle(ImportEvents.PAUSE, async (_, importId: string) => {
            logger.info(`[import-service] Pause import: ${importId}`);
            return await this.pauseImport(importId);
        });

        // 恢复导入
        this.ipc.handle(ImportEvents.RESUME, async (_, importId: string) => {
            logger.info(`[import-service] Resume import: ${importId}`);
            return await this.resumeImport(importId);
        });

        // 获取导入进度
        this.ipc.handle(ImportEvents.GET_PROGRESS, async (_, importId: string) => {
            return await this.getImportProgress(importId);
        });

        // 获取导入历史
        this.ipc.handle(ImportEvents.GET_HISTORY, async (_, limit?: number) => {
            logger.info(`[import-service] Get import history (limit: ${limit})`);
            return await this.getImportHistory(limit);
        });

        // 获取导入详情
        this.ipc.handle(ImportEvents.GET_DETAILS, async (_, historyId: string) => {
            logger.info(`[import-service] Get import details: ${historyId}`);
            return await this.getImportDetails(historyId);
        });

        // 预览撤销操作
        this.ipc.handle(ImportEvents.PREVIEW_UNDO, async (_, historyId: string) => {
            logger.info(`[import-service] Preview undo import: ${historyId}`);
            return await this.previewUndo(historyId);
        });

        // 撤销导入
        this.ipc.handle(ImportEvents.UNDO, async (_, historyId: string) => {
            logger.info(`[import-service] Undo import: ${historyId}`);
            return await this.undoImport(historyId);
        });

        // 选择多个目录
        this.ipc.handle(ImportEvents.CHOOSE_DIRECTORIES, async (_, multiSelect = true) => {
            logger.info(`[import-service] Choose directories (multiSelect: ${multiSelect})`);
            logger.info(`[import-service] mainWindow exists: ${!!this.mainWindow}`);
            return await this.chooseDirectories(multiSelect);
        });

        // 提取元数据
        this.ipc.handle(ImportEvents.EXTRACT_METADATA, async (_, request: MetadataRequest) => {
            logger.info(`[import-service] Extract metadata: ${request.filePath}`);
            return await this.extractMetadata(request);
        });
    }

    /**
     * 扫描多个源目录，获取文件组信息
     */
    private async scanDirectories(paths: string[], filters?: ImportFilters): Promise<FileGroup[]> {
        logger.info(`[import-service] Scanning directories: ${paths?.join(", ") || "无路径"}`);

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
            logger.info(`[import-service] Scan completed: found ${result.length} file groups`);
            return result;
        } catch (error) {
            logger.error(`[import-service] Scan directories failed: ${error}`);
            throw error;
        }
    }

    /**
     * 预览导入操作，不实际执行导入
     */
    private async previewImport(config: ImportConfig): Promise<ImportPreview> {
        logger.info(`[import-service] Generating import preview`);

        // 验证配置
        if (!config.sourcePaths || !Array.isArray(config.sourcePaths)) {
            logger.error(
                `[import-service] Invalid sourcePaths: ${typeof config.sourcePaths}, value: ${JSON.stringify(config.sourcePaths)}`,
            );
            throw new Error("sourcePaths must be a non-empty array");
        }

        if (config.sourcePaths.length === 0) {
            logger.warn(`[import-service] Empty sourcePaths array`);
            throw new Error("sourcePaths cannot be empty");
        }

        try {
            // 序列化配置中的日期对象
            const serializableConfig = {
                ...config,
                filters: {
                    ...config.filters,
                    dateRange: {
                        start:
                            config.filters.dateRange.start instanceof Date
                                ? config.filters.dateRange.start.toISOString()
                                : config.filters.dateRange.start,
                        end:
                            config.filters.dateRange.end instanceof Date
                                ? config.filters.dateRange.end.toISOString()
                                : config.filters.dateRange.end,
                    },
                },
            };

            // 创建临时的预览ID用于进度跟踪
            const previewId = `preview_${Date.now()}`;

            const response = await sendWorkerTask<ImportWorker, ImportRequest, ImportResponse>(
                this.worker,
                "preview_import",
                { action: "preview_import", payload: serializableConfig as any },
                (progress) => {
                    // 转发预览进度到渲染进程，确保包含发现的文件
                    this.mainWindow?.webContents.send("preview:progress", {
                        previewId,
                        progress,
                        files: progress.discoveredFiles, // 显式传递发现的文件
                    });
                },
            );

            if (!response.success || !response.data) {
                throw new Error(response.error || "Failed to generate import preview");
            }

            const result = response.data as ImportPreview;
            logger.info(
                `[import-service] Preview generated: ${result.statistics.totalFiles} files`,
            );
            return result;
        } catch (error) {
            logger.error(`[import-service] Preview import failed: ${error}`);
            throw error;
        }
    }

    /**
     * 启动导入操作（新的事件驱动模式）
     */
    private async startImport(
        config: ImportConfig & { importId?: string },
    ): Promise<{ importId: string }> {
        const importId = config.importId || this.generateImportId();

        logger.info(`[import-service] Starting import session: ${importId}`);

        // 创建导入会话
        const session: ImportSession = {
            importId,
            config: config as ImportConfig,
            status: "preparing",
            progress: this.createInitialProgress(),
            cancelRequested: false,
            startTime: new Date(),
        };

        this.activeSessions.set(importId, session);

        // 异步执行导入，不阻塞响应
        this.executeImportInBackground(importId);

        return { importId };
    }

    /**
     * 后台异步执行导入
     */
    private async executeImportInBackground(importId: string): Promise<void> {
        const session = this.activeSessions.get(importId);
        if (!session) {
            logger.error(`[import-service] Session not found: ${importId}`);
            return;
        }

        try {
            session.status = "processing";
            logger.info(`[import-service] Background execution started: ${importId}`);

            // 序列化配置中的日期对象
            const serializableConfig = this.serializeImportConfig(session.config);

            // 执行导入
            const response = await sendWorkerTask<ImportWorker, ImportRequest, ImportResponse>(
                this.worker,
                "execute_import",
                {
                    action: "execute_import",
                    payload: {
                        ...serializableConfig,
                        importId,
                    },
                },
            );

            if (!response.success || !response.data) {
                throw new Error(response.error || "Failed to execute import");
            }

            const result = response.data as ImportResult;

            // 检查是否被取消
            if (session.cancelRequested) {
                session.status = "cancelled";
                this.sendImportEvent(importId, "import:cancelled", {});
                logger.info(`[import-service] Import cancelled: ${importId}`);
            } else {
                session.status = "completed";
                this.sendImportEvent(importId, "import:complete", result);
                logger.info(`[import-service] Import completed: ${importId}`);

                // 记录导入历史
                await this.recordImportHistory(result);
            }
        } catch (error) {
            session.status = "failed";
            this.sendImportEvent(importId, "import:error", {
                error: error instanceof Error ? error.message : String(error),
            });
            logger.error(`[import-service] Import failed: ${importId}, error: ${error}`);
        } finally {
            // 清理会话（保留5分钟用于查询）
            setTimeout(() => this.activeSessions.delete(importId), 300000);
        }
    }

    /**
     * 执行导入操作（保留原有方法用于向后兼容）
     */
    private async executeImport(
        config: ImportConfig,
        callback?: EnhancedImportCallback,
    ): Promise<ImportResult> {
        logger.info(`[import-service] Starting import execution`);

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
                        start:
                            config.filters.dateRange.start instanceof Date
                                ? config.filters.dateRange.start.toISOString()
                                : config.filters.dateRange.start,
                        end:
                            config.filters.dateRange.end instanceof Date
                                ? config.filters.dateRange.end.toISOString()
                                : config.filters.dateRange.end,
                    },
                },
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
            logger.info(
                `[import-service] Import completed: ${result.successfulFiles}/${result.totalFiles} files imported`,
            );

            // 记录导入历史
            await this.recordImportHistory(result);

            return result;
        } catch (error) {
            logger.error(`[import-service] Execute import failed: ${error}`);
            throw error;
        }
    }

    /**
     * 取消正在进行的导入操作
     */
    private async cancelImport(importId: string): Promise<boolean> {
        logger.info(`[import-service] Cancelling import: ${importId}`);

        try {
            const session = this.activeSessions.get(importId);
            if (session) {
                session.cancelRequested = true;
                session.cancelTime = new Date();

                // 如果是在处理中，标记为取消中
                if (session.status === "processing") {
                    session.status = "cancelled";
                    this.sendImportEvent(importId, "import:cancelled", {});
                }

                this.activeSessions.set(importId, session);

                // 清理回调
                this.progressCallbacks.delete(importId);

                logger.info(`[import-service] Import cancellation requested: ${importId}`);
                return true;
            }

            logger.warn(`[import-service] Import session not found: ${importId}`);
            return false;
        } catch (error) {
            logger.error(`[import-service] Cancel import failed: ${error}`);
            return false;
        }
    }

    /**
     * 暂停正在进行的导入操作
     */
    private async pauseImport(importId: string): Promise<boolean> {
        logger.info(`[import-service] Pausing import: ${importId}`);

        try {
            const session = this.activeSessions.get(importId);
            if (session && session.status === "processing") {
                session.status = "paused";
                session.pauseTime = new Date();
                this.activeSessions.set(importId, session);

                logger.info(`[import-service] Import paused: ${importId}`);
                return true;
            }

            logger.warn(
                `[import-service] Cannot pause import: ${importId} (not found or not processing)`,
            );
            return false;
        } catch (error) {
            logger.error(`[import-service] Pause import failed: ${error}`);
            return false;
        }
    }

    /**
     * 恢复暂停的导入操作
     */
    private async resumeImport(importId: string): Promise<ImportResult> {
        logger.info(`[import-service] Resuming import: ${importId}`);

        try {
            const session = this.activeSessions.get(importId);
            if (session && session.status === "paused") {
                session.status = "processing";
                session.resumeCount = (session.resumeCount || 0) + 1;
                session.lastResumeTime = new Date();
                this.activeSessions.set(importId, session);

                // 继续执行导入
                const result = await this.executeImport(session.config);

                logger.info(`[import-service] Import resumed and completed: ${importId}`);
                return result;
            }

            throw new Error(`Cannot resume import: ${importId} (not found or not paused)`);
        } catch (error) {
            logger.error(`[import-service] Resume import failed: ${error}`);
            throw error;
        }
    }

    /**
     * 获取导入进度信息
     */
    private async getImportProgress(importId: string): Promise<ImportProgress> {
        logger.debug(`[import-service] Getting import progress: ${importId}`);

        try {
            const session = this.activeSessions.get(importId);
            if (session) {
                return session.progress;
            }

            // 如果会话不存在，返回默认进度
            return {
                totalFiles: 0,
                processedFiles: 0,
                successfulFiles: 0,
                skippedFiles: 0,
                errorFiles: 0,
                speed: 0,
                estimatedTimeRemaining: 0,
                remainingTime: 0,
                startTime: new Date(),
                errors: [],
                warnings: [],
                status: "completed",
            };
        } catch (error) {
            logger.error(`[import-service] Get import progress failed: ${error}`);
            throw error;
        }
    }

    /**
     * 获取导入历史记录
     */
    private async getImportHistory(limit?: number): Promise<ImportHistory[]> {
        logger.info(`[import-service] Getting import history (limit: ${limit})`);

        try {
            return await importHistoryManager.getHistory(limit);
        } catch (error) {
            logger.error(`[import-service] Get import history failed: ${error}`);
            throw error;
        }
    }

    /**
     * 获取导入详情
     */
    private async getImportDetails(historyId: string): Promise<ImportHistory | null> {
        logger.info(`[import-service] Getting import details: ${historyId}`);

        try {
            return await importHistoryManager.getImportDetails(historyId);
        } catch (error) {
            logger.error(`[import-service] Get import details failed: ${error}`);
            throw error;
        }
    }

    /**
     * 预览撤销操作
     */
    private async previewUndo(historyId: string): Promise<any> {
        logger.info(`[import-service] Previewing undo for import: ${historyId}`);

        try {
            return await importHistoryManager.previewUndo(historyId);
        } catch (error) {
            logger.error(`[import-service] Preview undo failed: ${error}`);
            throw error;
        }
    }

    /**
     * 撤销指定的导入操作
     */
    private async undoImport(historyId: string): Promise<UndoResult> {
        logger.info(`[import-service] Undoing import: ${historyId}`);

        try {
            return await importHistoryManager.undoImport(historyId);
        } catch (error) {
            logger.error(`[import-service] Undo import failed: ${error}`);
            throw error;
        }
    }

    /**
     * 选择多个目录
     */
    private async chooseDirectories(multiSelect = true): Promise<{ filePaths: string[] }> {
        logger.info(`[import-service] Choosing directories (multiSelect: ${multiSelect})`);

        try {
            logger.info("[import-service] 准备显示目录选择对话框...");
            if (!this.mainWindow) {
                throw new Error("Main window is not available");
            }
            const result = await dialog.showOpenDialog(this.mainWindow, {
                properties: multiSelect ? ["openDirectory", "multiSelections"] : ["openDirectory"],
                title: multiSelect ? "Select Source Directories" : "Select Target Directory",
            });

            logger.info(
                `[import-service] 对话框结果: canceled=${result.canceled}, paths=${result.filePaths?.length || 0}`,
            );

            if (result.canceled) {
                logger.info("[import-service] 用户取消了对话框");
                return { filePaths: [] };
            }

            logger.info(
                `[import-service] Selected directories: ${result.filePaths?.join(", ") || "无路径"}`,
            );
            return { filePaths: result.filePaths };
        } catch (error) {
            logger.error(`[import-service] Choose directories failed: ${error}`);
            throw error;
        }
    }

    /**
     * 提取文件元数据
     */
    private async extractMetadata(request: MetadataRequest): Promise<FileMetadata> {
        logger.debug(`[import-service] Extracting metadata: ${request.filePath}`);

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
            logger.debug(`[import-service] Metadata extracted: ${result.dateSource}`);
            return result;
        } catch (error) {
            logger.error(`[import-service] Extract metadata failed: ${error}`);
            throw error;
        }
    }

    /**
     * 记录导入历史
     */
    private async recordImportHistory(result: ImportResult): Promise<void> {
        logger.debug(`[import-service] Recording import history: ${result.importId}`);

        try {
            await importHistoryManager.recordImport(result);
            logger.info(`[import-service] Import history recorded: ${result.importId}`);
        } catch (error) {
            logger.error(`[import-service] Record import history failed: ${error}`);
            // 不抛出错误，因为这不应该影响导入结果
        }
    }

    /**
     * 关闭导入服务
     */
    async shutdown(): Promise<void> {
        logger.info("[import-service] Cleaning up import service");

        try {
            // 清理 IPC 处理器
            this.ipc.removeHandler(ImportEvents.SCAN_DIRECTORIES);
            this.ipc.removeHandler(ImportEvents.PREVIEW);
            this.ipc.removeHandler(ImportEvents.EXECUTE);
            this.ipc.removeHandler(ImportEvents.CANCEL);
            this.ipc.removeHandler(ImportEvents.PAUSE);
            this.ipc.removeHandler(ImportEvents.RESUME);
            this.ipc.removeHandler(ImportEvents.GET_PROGRESS);
            this.ipc.removeHandler(ImportEvents.GET_HISTORY);
            this.ipc.removeHandler(ImportEvents.GET_DETAILS);
            this.ipc.removeHandler(ImportEvents.PREVIEW_UNDO);
            this.ipc.removeHandler(ImportEvents.UNDO);
            this.ipc.removeHandler(ImportEvents.CHOOSE_DIRECTORIES);
            this.ipc.removeHandler(ImportEvents.EXTRACT_METADATA);

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

            logger.info("[ImportService] 导入服务已关闭");
        } catch (error) {
            logger.error(`[import-service] Cleanup failed: ${error}`);
        }
    }

    /**
     * 生成唯一导入ID
     */
    private generateImportId(): string {
        return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 创建初始进度对象
     */
    private createInitialProgress(): ImportProgress {
        return {
            totalFiles: 0,
            processedFiles: 0,
            successfulFiles: 0,
            skippedFiles: 0,
            errorFiles: 0,
            speed: 0,
            estimatedTimeRemaining: 0,
            remainingTime: 0,
            startTime: new Date(),
            errors: [],
            warnings: [],
            status: "preparing",
            currentFile: "",
        };
    }

    /**
     * 序列化导入配置（处理Date对象）
     */
    private serializeImportConfig(config: ImportConfig): any {
        return {
            ...config,
            filters: {
                ...config.filters,
                dateRange: {
                    start:
                        config.filters.dateRange.start instanceof Date
                            ? config.filters.dateRange.start.toISOString()
                            : config.filters.dateRange.start,
                    end:
                        config.filters.dateRange.end instanceof Date
                            ? config.filters.dateRange.end.toISOString()
                            : config.filters.dateRange.end,
                },
            },
        };
    }

    /**
     * 发送导入事件到 Renderer
     */
    private sendImportEvent(importId: string, eventName: string, data: any): void {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(eventName, {
                importId,
                timestamp: new Date(),
                ...data,
            });
            logger.debug(`[import-service] Sent event: ${eventName} for import: ${importId}`);
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
