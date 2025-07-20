import { app } from "electron";
import * as fs from "fs-extra";
import * as path from "path";
import * as crypto from "crypto";
import { getLogger } from "@common/logger";
import type {
    ImportResult,
    ImportHistory,
    UndoResult,
    ImportHistoryEntry,
    FileImportInfo,
    UndoPreview,
} from "@common/import-types";
import type { PhotasaConfig } from "@common/config-types";

const logger = getLogger("import-history");

/**
 * 导入历史管理器
 * 负责记录、查询和管理导入操作的历史记录
 */
export class ImportHistoryManager {
    private readonly historyFile: string;
    private readonly maxHistoryEntries = 100;
    private historyCache: ImportHistory[] | null = null;

    constructor() {
        const userDataPath = app.getPath("userData");
        const photasaDir = path.join(userDataPath, ".photasa");
        this.historyFile = path.join(photasaDir, "import-history.json");
    }

    /**
     * 记录导入操作
     * 需求6.1: 记录导入操作的详细信息
     */
    async recordImport(result: ImportResult): Promise<void> {
        try {
            const historyEntry: ImportHistory = {
                id: result.importId,
                timestamp: new Date(),
                sourcePaths: result.sourcePaths,
                targetPath: result.targetPath,
                result,
                canUndo: this.canUndoImport(result),
                fileList: await this.createFileList(result.importedFiles),
                statistics: {
                    totalFiles: result.totalFiles,
                    successfulFiles: result.successfulFiles,
                    skippedFiles: result.skippedFiles,
                    errorFiles: result.errorFiles,
                    totalSize: result.totalSize,
                    duplicateCount: result.duplicateHandling?.length || 0,
                },
            };

            const history = await this.loadHistory();
            history.unshift(historyEntry);

            // 保持历史记录数量限制
            if (history.length > this.maxHistoryEntries) {
                history.splice(this.maxHistoryEntries);
            }

            await this.saveHistory(history);
            this.historyCache = history;

            logger.info(
                `[History] Recorded import ${result.importId} with ${result.successfulFiles} files`,
            );
        } catch (error) {
            logger.error(`[History] Failed to record import: ${error}`);
            throw error;
        }
    }

    /**
     * 获取导入历史
     * 需求6.2: 显示最近的导入操作列表
     */
    async getHistory(limit?: number): Promise<ImportHistory[]> {
        try {
            const history = await this.loadHistory();
            return limit ? history.slice(0, limit) : history;
        } catch (error) {
            logger.error(`[History] Failed to get history: ${error}`);
            return [];
        }
    }

    /**
     * 获取特定导入的详细信息
     * 需求6.3: 显示该次导入的详细信息和文件列表
     */
    async getImportDetails(historyId: string): Promise<ImportHistory | null> {
        try {
            const history = await this.loadHistory();
            return history.find((h) => h.id === historyId) || null;
        } catch (error) {
            logger.error(`[History] Failed to get import details: ${error}`);
            return null;
        }
    }

    /**
     * 预览撤销操作
     * 需求6.5: 显示撤销操作的详细预览
     */
    async previewUndo(historyId: string): Promise<UndoPreview> {
        const history = await this.loadHistory();
        const entry = history.find((h) => h.id === historyId);

        if (!entry) {
            throw new Error("Import history entry not found");
        }

        const preview: UndoPreview = {
            historyId,
            canUndo: entry.canUndo,
            reason: entry.canUndo ? "" : "Import contains overwritten files or has errors",
            filesToDelete: [],
            directoriesToCleanup: new Set(),
            potentialIssues: [],
            estimatedTime: 0,
        };

        if (!entry.canUndo) {
            return preview;
        }

        // 检查每个文件的状态
        for (const fileInfo of entry.fileList) {
            try {
                if (await fs.pathExists(fileInfo.targetPath)) {
                    // 验证文件完整性
                    if (fileInfo.checksum) {
                        const currentChecksum = await this.calculateChecksum(fileInfo.targetPath);
                        if (currentChecksum !== fileInfo.checksum) {
                            preview.potentialIssues.push({
                                file: fileInfo.targetPath,
                                issue: "File has been modified since import",
                                severity: "warning",
                            });
                        }
                    }

                    preview.filesToDelete.push({
                        path: fileInfo.targetPath,
                        size: fileInfo.size,
                        originalPath: fileInfo.originalPath,
                        importTime: fileInfo.importTime,
                    });

                    preview.directoriesToCleanup.add(path.dirname(fileInfo.targetPath));
                } else {
                    preview.potentialIssues.push({
                        file: fileInfo.targetPath,
                        issue: "File no longer exists",
                        severity: "info",
                    });
                }
            } catch (error) {
                preview.potentialIssues.push({
                    file: fileInfo.targetPath,
                    issue: `Cannot access file: ${error}`,
                    severity: "error",
                });
            }
        }

        // 估算撤销时间（基于文件数量）
        preview.estimatedTime = Math.max(1, Math.ceil(preview.filesToDelete.length / 10));

        return preview;
    }

    /**
     * 撤销导入操作
     * 需求6.4: 删除该次导入的所有文件并更新配置
     */
    async undoImport(historyId: string): Promise<UndoResult> {
        const history = await this.loadHistory();
        const entry = history.find((h) => h.id === historyId);

        if (!entry) {
            throw new Error("Import history entry not found");
        }

        if (!entry.canUndo) {
            throw new Error("This import cannot be undone");
        }

        logger.info(`[History] Starting undo for import ${historyId}`);

        const undoResult: UndoResult = {
            success: true,
            deletedFiles: [],
            errors: [],
            restoredDirectories: new Set(),
            undoId: crypto.randomUUID(),
            timestamp: new Date(),
        };

        // 删除导入的文件
        for (const fileInfo of entry.fileList) {
            try {
                if (await fs.pathExists(fileInfo.targetPath)) {
                    // 验证文件完整性（如果有校验和）
                    if (fileInfo.checksum) {
                        const currentChecksum = await this.calculateChecksum(fileInfo.targetPath);
                        if (currentChecksum !== fileInfo.checksum) {
                            undoResult.errors.push({
                                file: fileInfo.targetPath,
                                error: "File has been modified since import",
                            });
                            continue;
                        }
                    }

                    await fs.remove(fileInfo.targetPath);
                    undoResult.deletedFiles.push(fileInfo.targetPath);

                    // 记录需要清理的空目录
                    undoResult.restoredDirectories.add(path.dirname(fileInfo.targetPath));

                    logger.debug(`[History] Deleted file: ${fileInfo.targetPath}`);
                }
            } catch (error) {
                undoResult.errors.push({
                    file: fileInfo.targetPath,
                    error: error instanceof Error ? error.message : "Unknown error",
                });
                logger.error(`[History] Failed to delete ${fileInfo.targetPath}: ${error}`);
            }
        }

        // 清理空目录
        await this.cleanupEmptyDirectories(Array.from(undoResult.restoredDirectories));

        // 更新Photasa配置文件，移除已删除的文件记录
        await this.updatePhotasaConfig(entry.targetPath, undoResult.deletedFiles);

        // 更新历史记录状态
        entry.canUndo = false;
        entry.undoTimestamp = new Date();
        entry.undoResult = undoResult;
        await this.saveHistory(history);
        this.historyCache = history;

        undoResult.success = undoResult.errors.length === 0;

        logger.info(
            `[History] Undo completed for import ${historyId}. Deleted: ${undoResult.deletedFiles.length}, Errors: ${undoResult.errors.length}`,
        );

        return undoResult;
    }

    /**
     * 清理过期的历史记录
     */
    async cleanupHistory(olderThanDays = 90): Promise<number> {
        try {
            const history = await this.loadHistory();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            const originalCount = history.length;
            const filteredHistory = history.filter(
                (entry) => new Date(entry.timestamp) > cutoffDate,
            );

            if (filteredHistory.length !== originalCount) {
                await this.saveHistory(filteredHistory);
                this.historyCache = filteredHistory;

                const cleanedCount = originalCount - filteredHistory.length;
                logger.info(`[History] Cleaned up ${cleanedCount} old history entries`);
                return cleanedCount;
            }

            return 0;
        } catch (error) {
            logger.error(`[History] Failed to cleanup history: ${error}`);
            return 0;
        }
    }

    /**
     * 判断导入是否可以撤销
     */
    private canUndoImport(result: ImportResult): boolean {
        // 只有成功导入且没有覆盖文件的导入可以撤销
        if (!result.success || result.errorFiles > 0) {
            return false;
        }

        // 检查是否有覆盖操作
        if (result.duplicateHandling) {
            const hasOverwrite = result.duplicateHandling.some((d) => d.action === "overwrite");
            if (hasOverwrite) {
                return false;
            }
        }

        return true;
    }

    /**
     * 创建文件列表用于历史记录
     */
    private async createFileList(
        importedFiles: FileImportInfo[],
    ): Promise<ImportHistoryEntry["fileList"]> {
        const fileList: ImportHistoryEntry["fileList"] = [];

        for (const file of importedFiles) {
            try {
                // 计算文件校验和（可选，用于验证文件完整性）
                const checksum = await this.calculateChecksum(file.targetPath);

                fileList.push({
                    originalPath: file.sourcePath,
                    targetPath: file.targetPath,
                    size: file.size,
                    checksum,
                    importTime: new Date(),
                });
            } catch (error) {
                // 如果无法计算校验和，仍然记录文件信息
                fileList.push({
                    originalPath: file.sourcePath,
                    targetPath: file.targetPath,
                    size: file.size,
                    checksum: null,
                    importTime: new Date(),
                });
            }
        }

        return fileList;
    }

    /**
     * 清理空目录
     */
    private async cleanupEmptyDirectories(directories: string[]): Promise<void> {
        for (const dir of directories) {
            try {
                const entries = await fs.readdir(dir);
                if (entries.length === 0) {
                    await fs.rmdir(dir);
                    logger.debug(`[History] Removed empty directory: ${dir}`);

                    // 递归检查父目录
                    const parentDir = path.dirname(dir);
                    if (parentDir !== dir && parentDir !== path.parse(dir).root) {
                        await this.cleanupEmptyDirectories([parentDir]);
                    }
                }
            } catch (error) {
                // 忽略清理错误，不影响主要功能
                logger.debug(`[History] Failed to cleanup directory ${dir}: ${error}`);
            }
        }
    }

    /**
     * 计算文件校验和
     */
    private async calculateChecksum(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash("md5");
            const stream = fs.createReadStream(filePath);

            stream.on("data", (data) => hash.update(data));
            stream.on("end", () => resolve(hash.digest("hex")));
            stream.on("error", reject);
        });
    }

    /**
     * 加载历史记录
     */
    private async loadHistory(): Promise<ImportHistory[]> {
        if (this.historyCache) {
            return this.historyCache;
        }

        try {
            if (await fs.pathExists(this.historyFile)) {
                const data = await fs.readJSON(this.historyFile);
                const history = data.map((entry: any) => ({
                    ...entry,
                    timestamp: new Date(entry.timestamp),
                    undoTimestamp: entry.undoTimestamp ? new Date(entry.undoTimestamp) : undefined,
                    fileList:
                        entry.fileList?.map((file: any) => ({
                            ...file,
                            importTime: file.importTime
                                ? new Date(file.importTime)
                                : new Date(entry.timestamp),
                        })) || [],
                }));

                this.historyCache = history;
                return history;
            }
        } catch (error) {
            logger.error(`[History] Failed to load import history: ${error}`);
        }

        return [];
    }

    /**
     * 更新Photasa配置文件，移除已删除的文件记录
     * 需求6.4: 更新配置文件
     */
    private async updatePhotasaConfig(targetPath: string, deletedFiles: string[]): Promise<void> {
        try {
            const configPath = path.join(targetPath, ".photasa.json");

            if (await fs.pathExists(configPath)) {
                const config: PhotasaConfig = await fs.readJSON(configPath);

                // 移除已删除的文件记录
                const deletedSet = new Set(deletedFiles);
                const originalCount = config.photoList?.length || 0;

                if (config.photoList) {
                    config.photoList = config.photoList.filter(
                        (photo) => !deletedSet.has(photo.path),
                    );
                }

                // 更新配置文件
                await fs.writeJSON(configPath, config, { spaces: 2 });

                const removedCount = originalCount - (config.photoList?.length || 0);
                logger.info(
                    `[History] Updated Photasa config: removed ${removedCount} file records from ${configPath}`,
                );
            } else {
                logger.debug(
                    `[History] Photasa config not found at ${configPath}, skipping config update`,
                );
            }
        } catch (error) {
            logger.error(`[History] Failed to update Photasa config: ${error}`);
            // 不抛出错误，因为配置更新失败不应该影响撤销操作
        }
    }

    /**
     * 保存历史记录
     */
    private async saveHistory(history: ImportHistory[]): Promise<void> {
        try {
            await fs.ensureDir(path.dirname(this.historyFile));
            await fs.writeJSON(this.historyFile, history, { spaces: 2 });
            logger.debug(`[History] Saved ${history.length} history entries`);
        } catch (error) {
            logger.error(`[History] Failed to save import history: ${error}`);
            throw error;
        }
    }
}

// 导出单例实例
export const importHistoryManager = new ImportHistoryManager();
