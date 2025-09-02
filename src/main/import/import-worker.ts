import { parentPort } from "worker_threads";
import { loggers } from "@common/logger";
import {
    createResponse,
    createPreviewProgressEvent,
    createProgressEvent,
} from "@common/worker-util";
import type { WorkerMessage } from "@common/types";
import type {
    ImportRequest,
    ImportResponse,
    MetadataRequest,
    FileGroup,
    FileInfo,
    ScanDirectoriesRequest,
    ImportConfig,
    ImportResult,
    ImportPreview,
    FileStatistics,
    DuplicateFileInfo,
} from "@common/import-types";
import {
    ImportWorkerActions,
    ImportWorkerActionType,
    FileTypeDetectors,
    DuplicateStrategies,
    ErrorCategories,
    ErrorSeverities,
    DateSources,
    FileGroupTypes,
} from "@common/constants";
import {
    extractMetadata,
    processFileGroup,
    FileGroupDetector,
    generateDatePath,
} from "./import-handler";
import { DuplicateDetector, DuplicateHandlerFactory } from "./duplicate-handler";
import { computeFallbackDate } from "./metadata/parsers/date-parser";
import fs from "fs-extra";
import path from "path";
import isImage from "is-image";
import isVideo from "is-video";
import { v4 as uuidv4 } from "uuid";
import { shouldIgnorePhotasaPath } from "@common/utils";

const logger = loggers.worker;

// ==================== 映射设计模式：动作处理器映射 ====================

/**
 * 动作处理器映射 - 使用策略模式处理不同的导入操作
 */
const ACTION_HANDLERS = {
    [ImportWorkerActions.EXTRACT_METADATA]: handleExtractMetadata,
    [ImportWorkerActions.PROCESS_FILE_GROUP]: handleProcessFileGroup,
    [ImportWorkerActions.SCAN_DIRECTORIES]: handleScanDirectories,
    [ImportWorkerActions.PREVIEW_IMPORT]: handlePreviewImport,
    [ImportWorkerActions.EXECUTE_IMPORT]: handleExecuteImport,
} as const;

// ==================== 映射设计模式：文件类型检测映射 ====================

/**
 * 文件类型检测映射 - 使用工厂模式创建文件类型检测器
 */
const FILE_TYPE_DETECTORS = {
    [FileTypeDetectors.IMAGE]: isImage,
    [FileTypeDetectors.VIDEO]: isVideo,
} as const;

// ==================== 核心消息处理逻辑 ====================

/**
 * 主消息处理器 - 使用映射模式路由到相应的处理器
 */
parentPort?.on("message", async (message: WorkerMessage<ImportRequest>) => {
    try {
        const { action } = message;

        // 使用映射模式查找处理器
        const handler = ACTION_HANDLERS[action as ImportWorkerActionType];

        if (handler) {
            await handler(message);
        } else {
            const errorResponse = createResponse<ImportRequest, ImportResponse>(message, {
                success: false,
                error: "Unknown action",
            });
            parentPort?.postMessage(errorResponse);
        }
    } catch (error) {
        logger.error(`[import-worker] 处理消息时出错: ${error}`);
        const response = createResponse<ImportRequest, ImportResponse>(message, {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        });
        parentPort?.postMessage(response);
    }
});

// ==================== 动作处理器实现 ====================

/**
 * 处理元数据提取请求
 */
async function handleExtractMetadata(message: WorkerMessage<ImportRequest>): Promise<void> {
    const request = message.payload as unknown as MetadataRequest;

    try {
        const metadata = await extractMetadata(request, logger);
        const response = createResponse<ImportRequest, ImportResponse>(message, {
            success: true,
            data: metadata,
        });
        parentPort?.postMessage(response);
    } catch (error) {
        logger.error(`[import-worker] 元数据提取失败: ${error}`);
        const response = createResponse<ImportRequest, ImportResponse>(message, {
            success: false,
            error: error instanceof Error ? error.message : "Metadata extraction failed",
        });
        parentPort?.postMessage(response);
    }
}

/**
 * 处理文件组处理请求
 */
async function handleProcessFileGroup(message: WorkerMessage<ImportRequest>): Promise<void> {
    const group = message.payload as unknown as FileGroup;

    try {
        const processedGroup = await processFileGroup(group, logger);
        const response = createResponse<ImportRequest, ImportResponse>(message, {
            success: true,
            data: processedGroup,
        });
        parentPort?.postMessage(response);
    } catch (error) {
        logger.error(`[import-worker] 文件组处理失败: ${error}`);
        const response = createResponse<ImportRequest, ImportResponse>(message, {
            success: false,
            error: error instanceof Error ? error.message : "File group processing failed",
        });
        parentPort?.postMessage(response);
    }
}

/**
 * 处理目录扫描请求
 */
async function handleScanDirectories(message: WorkerMessage<ImportRequest>): Promise<void> {
    const importRequest = message.payload as ImportRequest;
    const request = importRequest.payload as ScanDirectoriesRequest;

    try {
        const fileGroups = await scanDirectoriesForFiles(request.paths, request.filters);
        const response = createResponse<ImportRequest, ImportResponse>(message, {
            success: true,
            data: fileGroups,
        });
        parentPort?.postMessage(response);
    } catch (error) {
        logger.error(`[import-worker] 目录扫描失败: ${error}`);
        const response = createResponse<ImportRequest, ImportResponse>(message, {
            success: false,
            error: error instanceof Error ? error.message : "Directory scanning failed",
        });
        parentPort?.postMessage(response);
    }
}

/**
 * 处理导入预览请求
 */
async function handlePreviewImport(message: WorkerMessage<ImportRequest>): Promise<void> {
    const request = message.payload as ImportRequest;
    const config = request.payload as ImportConfig;

    try {
        const processedConfig = processImportConfig(config);

        // 创建进度回调函数，将进度事件发送给主进程
        const progressCallback = (progress: any) => {
            const progressEvent = createPreviewProgressEvent(message.id, progress);
            parentPort?.postMessage(progressEvent);
        };

        const preview = await generateImportPreview(processedConfig, progressCallback);
        const response = createResponse<ImportRequest, ImportResponse>(message, {
            success: true,
            data: preview,
        });
        parentPort?.postMessage(response);
    } catch (error) {
        logger.error(`[import-worker] 导入预览失败: ${error}`);
        const response = createResponse<ImportRequest, ImportResponse>(message, {
            success: false,
            error: error instanceof Error ? error.message : "Import preview failed",
        });
        parentPort?.postMessage(response);
    }
}

/**
 * 处理执行导入请求
 */
async function handleExecuteImport(message: WorkerMessage<ImportRequest>): Promise<void> {
    const request = message.payload as ImportRequest;
    const configWithImportId = request.payload as ImportConfig & { importId?: string };
    const config = configWithImportId as ImportConfig;
    const importId = configWithImportId.importId;

    logger.debug(
        `[import-worker] 执行导入: ${config.sourcePaths?.join(", ") || "无源路径"}, importId: ${importId}`,
    );

    try {
        const processedConfig = processImportConfig(config);
        const result = await executeImportProcess(processedConfig, importId);

        const serializableResult = JSON.parse(JSON.stringify(result));
        const response = createResponse<ImportRequest, ImportResponse>(message, {
            success: true,
            data: serializableResult,
        });
        parentPort?.postMessage(response);
    } catch (error) {
        logger.error(`[import-worker] 导入执行失败: ${error}`);

        const serializableError = createSerializableError(error);
        const response = createResponse<ImportRequest, ImportResponse>(message, {
            success: false,
            error: serializableError.message,
        });
        parentPort?.postMessage(response);
    }
}

// ==================== 工具函数 ====================

/**
 * 发送进度更新到主进程
 */
function sendProgressUpdate(
    importId: string,
    importState: ReturnType<typeof createImportState>,
    totalFiles: number,
    currentFile: string,
    startTime: number,
): void {
    const processedFiles =
        importState.successfulFiles + importState.skippedFiles + importState.errorFiles;
    const currentTime = Date.now();
    const elapsedTime = (currentTime - startTime) / 1000;
    const speed = elapsedTime > 0 ? processedFiles / elapsedTime : 0;
    const remainingFiles = totalFiles - processedFiles;
    const estimatedTimeRemaining = speed > 0 ? remainingFiles / speed : 0;

    const progressEvent = createProgressEvent(importId, {
        processedFiles,
        totalFiles,
        successfulFiles: importState.successfulFiles,
        skippedFiles: importState.skippedFiles,
        errorFiles: importState.errorFiles,
        currentFile,
        speed,
        estimatedTimeRemaining,
        errors: importState.errors,
        warnings: importState.warnings,
    });

    parentPort?.postMessage(progressEvent);
}

/**
 * 处理导入配置 - 使用工厂模式处理日期对象
 */
function processImportConfig(config: ImportConfig): ImportConfig {
    return {
        ...config,
        filters: config.filters
            ? {
                  ...config.filters,
                  dateRange: config.filters.dateRange
                      ? {
                            start: normalizeDate(config.filters.dateRange.start),
                            end: normalizeDate(config.filters.dateRange.end),
                        }
                      : { start: new Date(0), end: new Date() },
              }
            : createDefaultFilters(),
    };
}

/**
 * 创建默认过滤器 - 使用工厂模式
 */
function createDefaultFilters() {
    return {
        fileTypes: [],
        sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
        dateRange: { start: new Date(0), end: new Date() },
        includeSubfolders: true,
    };
}

/**
 * 标准化日期对象 - 使用策略模式处理不同类型的日期输入
 */
function normalizeDate(dateInput: Date | string): Date {
    return dateInput instanceof Date ? dateInput : new Date(dateInput);
}

/**
 * 创建可序列化的错误对象 - 使用工厂模式
 */
function createSerializableError(error: unknown) {
    return error instanceof Error
        ? {
              message: error.message,
              name: error.name,
              stack: error.stack,
              code: (error as any).code || undefined,
          }
        : { message: String(error) };
}

// ==================== 文件扫描逻辑 ====================

/**
 * 扫描多个目录获取文件信息 - 使用策略模式，支持进度回调
 */
async function scanDirectoriesForFiles(
    paths: string[],
    filters?: any,
    progressCallback?: (progress: any) => void,
): Promise<FileGroup[]> {
    const allFiles: FileInfo[] = [];

    if (!Array.isArray(paths)) {
        logger.error(
            `[import-worker] paths 不是数组: ${typeof paths}, 值: ${JSON.stringify(paths)}`,
        );
        return [];
    }

    let directoriesScanned = 0;

    for (const dirPath of paths) {
        if (!(await fs.pathExists(dirPath))) {
            logger.warn(`[import-worker] 目录不存在: ${dirPath}`);
            continue;
        }

        // 发送扫描进度
        progressCallback?.({
            stage: "scanning",
            currentPath: dirPath,
            filesFound: allFiles.length,
            directoriesScanned,
            totalDirectories: paths.length,
            discoveredFiles: allFiles.slice(-30), // 显示最新发现的30个文件
            message: `正在扫描：${path.basename(dirPath)}`,
        });

        const files = await scanSingleDirectory(dirPath, filters, progressCallback, allFiles);
        allFiles.push(...files);
        directoriesScanned++;

        // 扫描完每个目录后发送更新
        if (files.length > 0) {
            progressCallback?.({
                stage: "scanning",
                currentPath: dirPath,
                filesFound: allFiles.length,
                directoriesScanned,
                totalDirectories: paths.length,
                discoveredFiles: allFiles.slice(-30), // 显示全局最新发现的30个文件
                message: `已扫描目录：${path.basename(dirPath)} (${allFiles.length} 个文件)`,
            });
        }
    }

    const detector = new FileGroupDetector();
    const fileGroups = detector.detectFileGroupsEnhanced(allFiles, logger);

    return fileGroups;
}

/**
 * 扫描单个目录 - 使用递归策略模式，支持进度回调
 */
async function scanSingleDirectory(
    dirPath: string,
    filters?: any,
    progressCallback?: (progress: any) => void,
    allFiles?: FileInfo[],
): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (shouldIgnorePhotasaPath(fullPath)) {
                continue;
            }

            if (entry.isDirectory()) {
                if (filters?.includeSubfolders !== false) {
                    const subFiles = await scanSingleDirectory(
                        fullPath,
                        filters,
                        progressCallback,
                        allFiles,
                    );
                    files.push(...subFiles);
                }
                continue;
            }

            if (entry.isFile() && shouldIncludeFile(fullPath, filters)) {
                const fileInfo = await createFileInfo(fullPath);
                if (fileInfo) {
                    files.push(fileInfo);

                    // 每发现新文件就发送进度更新，但限制频率避免过于频繁
                    if (files.length % 3 === 0 || files.length <= 15) {
                        const totalFound = (allFiles?.length || 0) + files.length;

                        // 将新发现的文件添加到全局列表的副本中以便预览
                        const allDiscoveredFiles = [...(allFiles || []), ...files];

                        progressCallback?.({
                            stage: "scanning",
                            currentPath: dirPath,
                            filesFound: totalFound,
                            discoveredFiles: allDiscoveredFiles.slice(-30), // 显示全局最新发现的30个文件
                            message: `已发现 ${totalFound} 个文件`,
                        });
                    }
                }
            }
        }
    } catch (error) {
        logger.error(`[import-worker] 扫描目录失败 ${dirPath}: ${error}`);
    }

    return files;
}

/**
 * 创建文件信息对象 - 使用工厂模式
 */
async function createFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
        const stats = await fs.stat(filePath);
        const fileName = path.basename(filePath);
        const fileType = detectFileType(filePath);

        // 对于HEIC文件，立即提取元数据以获取正确的日期
        let dateSource: (typeof DateSources)[keyof typeof DateSources] = DateSources.FILE_CREATED;
        let dateTime: Date = stats.birthtime;

        // 对于图片和视频文件，立即提取元数据以获取正确的日期
        let extractedMetadata: any = null;

        if (fileType === FileTypeDetectors.IMAGE || fileType === FileTypeDetectors.VIDEO) {
            try {
                extractedMetadata = await extractMetadata({ filePath }, logger);
                if (extractedMetadata.dateTime) {
                    dateTime = extractedMetadata.dateTime;
                    dateSource = extractedMetadata.dateSource;
                }
            } catch (error) {
                const fileTypeName = fileType === FileTypeDetectors.IMAGE ? "图片" : "视频";
                logger.warn(
                    `[import-worker] ${fileTypeName}文件元数据提取失败: ${fileName}, 使用智能日期回退: ${error}`,
                );
                // 使用智能日期回退：选择创建时间和修改时间中较早的
                const fallback = computeFallbackDate(stats.birthtime, stats.mtime, logger);
                dateTime = fallback.date;
                dateSource = fallback.source;
                logger.debug(
                    `[import-worker] ${fileTypeName}文件使用智能回退: ${fileName}, dateSource: ${dateSource}, dateTime: ${dateTime.toISOString()}`,
                );
            }
        }

        const fileInfo: FileInfo = {
            path: filePath,
            name: fileName,
            size: stats.size,
            type: fileType,
            dateSource: dateSource as any, // ✅ Use extracted metadata
            modifiedTime: stats.mtime,
            createdTime: stats.birthtime,
            dateTime: dateTime, // ✅ Use extracted metadata
            metadata: extractedMetadata, // ✅ Store metadata to prevent double extraction
            file: filePath,
            isImage: fileType === FileTypeDetectors.IMAGE,
            isVideo: fileType === FileTypeDetectors.VIDEO,
            target: "",
            targetDir: "",
            targetFileName: "",
            targetFullPath: "",
        };

        return fileInfo;
    } catch (error) {
        logger.error(`[import-worker] 创建文件信息失败 ${filePath}: ${error}`);
        return null;
    }
}

/**
 * 检测文件类型 - 使用策略模式
 */
function detectFileType(filePath: string): "image" | "video" | "other" {
    if (FILE_TYPE_DETECTORS[FileTypeDetectors.IMAGE](filePath)) {
        return FileTypeDetectors.IMAGE;
    }
    if (FILE_TYPE_DETECTORS[FileTypeDetectors.VIDEO](filePath)) {
        return FileTypeDetectors.VIDEO;
    }
    return FileTypeDetectors.OTHER;
}

/**
 * 检查文件是否应该包含在扫描结果中 - 使用策略模式
 */
function shouldIncludeFile(filePath: string, filters?: any): boolean {
    const fileName = path.basename(filePath);

    if (fileName.startsWith(".") || shouldIgnorePhotasaPath(filePath)) {
        return false;
    }

    return applyFileTypeFilter(filePath, filters) && applySizeFilter(filePath, filters);
}

/**
 * 应用文件类型过滤器 - 使用策略模式
 */
function applyFileTypeFilter(filePath: string, filters?: any): boolean {
    if (!filters?.fileTypes || filters.fileTypes.length === 0) {
        return true;
    }

    const hasAll = filters.fileTypes.includes(FileTypeDetectors.ALL);
    const hasImage =
        filters.fileTypes.includes(FileTypeDetectors.IMAGE) &&
        FILE_TYPE_DETECTORS[FileTypeDetectors.IMAGE](filePath);
    const hasVideo =
        filters.fileTypes.includes(FileTypeDetectors.VIDEO) &&
        FILE_TYPE_DETECTORS[FileTypeDetectors.VIDEO](filePath);

    return hasAll || hasImage || hasVideo;
}

/**
 * 应用文件大小过滤器 - 使用策略模式
 */
function applySizeFilter(filePath: string, filters?: any): boolean {
    if (!filters?.sizeRange) {
        return true;
    }

    try {
        const stats = fs.statSync(filePath);
        return stats.size >= filters.sizeRange.min && stats.size <= filters.sizeRange.max;
    } catch (error) {
        return false;
    }
}

// ==================== 导入预览逻辑 ====================

/**
 * 生成导入预览 - 使用工厂模式，支持进度回调
 */
async function generateImportPreview(
    config: ImportConfig,
    progressCallback?: (progress: any) => void,
): Promise<ImportPreview> {
    if (!Array.isArray(config.sourcePaths)) {
        logger.error(
            `[import-worker] config.sourcePaths 不是数组: ${typeof config.sourcePaths}, 值: ${JSON.stringify(config.sourcePaths)}`,
        );
        throw new Error("sourcePaths must be an array");
    }

    // 阶段1: 扫描目录
    progressCallback?.({
        stage: "scanning",
        filesFound: 0,
        directoriesScanned: 0,
        message: "开始扫描目录...",
    });

    const rawFileGroups = await scanDirectoriesForFiles(
        config.sourcePaths,
        config.filters,
        progressCallback,
    );

    // 阶段2: 处理文件组
    progressCallback?.({
        stage: "processing",
        filesFound: rawFileGroups.reduce((sum, group) => sum + group.files.length, 0),
        directoriesScanned: config.sourcePaths.length,
        message: "处理文件组和元数据...",
    });

    const fileGroups = await processFileGroups(rawFileGroups);

    // 阶段3: 计算统计信息
    progressCallback?.({
        stage: "calculating",
        filesFound: fileGroups.reduce((sum, group) => sum + group.files.length, 0),
        directoriesScanned: config.sourcePaths.length,
        message: "计算统计信息...",
    });

    const statistics = calculateFileStatistics(fileGroups);
    const duplicates = await detectDuplicateFiles(fileGroups, config.targetPath);
    const estimatedDuration = estimateImportDuration(fileGroups);
    const targetStructure = await generateTargetStructure(fileGroups, config.targetPath);

    // 完成
    progressCallback?.({
        stage: "completed",
        filesFound: statistics.totalFiles,
        directoriesScanned: config.sourcePaths.length,
        partialStatistics: statistics,
        message: "预览生成完成",
    });

    return {
        fileGroups,
        statistics,
        duplicates,
        estimatedDuration,
        targetStructure,
    };
}

/**
 * 处理文件组 - 使用策略模式
 */
async function processFileGroups(fileGroups: FileGroup[]): Promise<FileGroup[]> {
    const processedGroups: FileGroup[] = [];

    for (const group of fileGroups) {
        const processedGroup = await processFileGroup(group, logger);
        processedGroups.push(processedGroup);
    }

    return processedGroups;
}

/**
 * 计算文件统计信息 - 使用策略模式
 */
function calculateFileStatistics(fileGroups: FileGroup[]): FileStatistics {
    const stats = {
        totalFiles: 0,
        imageFiles: 0,
        videoFiles: 0,
        otherFiles: 0,
        totalSize: 0,
        groupCount: 0,
    };

    for (const group of fileGroups) {
        stats.totalFiles += group.files.length;
        stats.totalSize += group.totalSize;

        if (group.type === FileGroupTypes.GROUP) {
            stats.groupCount++;
        }

        for (const file of group.files) {
            switch (file.type) {
                case FileTypeDetectors.IMAGE:
                    stats.imageFiles++;
                    break;
                case FileTypeDetectors.VIDEO:
                    stats.videoFiles++;
                    break;
                default:
                    stats.otherFiles++;
                    break;
            }
        }
    }

    return {
        ...stats,
        duplicateCount: 0,
    };
}

/**
 * 检测重复文件 - 使用策略模式
 */
async function detectDuplicateFiles(
    fileGroups: FileGroup[],
    targetPath: string,
): Promise<DuplicateFileInfo[]> {
    const detector = new DuplicateDetector();
    const duplicates = await detector.detectDuplicates(fileGroups, targetPath);

    return duplicates;
}

/**
 * 估算导入时间 - 使用策略模式
 */
function estimateImportDuration(fileGroups: FileGroup[]): number {
    const totalSize = fileGroups.reduce((sum, group) => sum + group.totalSize, 0);
    const totalFiles = fileGroups.reduce((sum, group) => sum + group.files.length, 0);

    const sizeBasedTime = totalSize / (100 * 1024 * 1024); // 100MB/s
    const fileBasedTime = totalFiles * 0.1; // 每个文件0.1秒

    return Math.max(sizeBasedTime + fileBasedTime, 1);
}

/**
 * 生成目标结构预览 - 使用策略模式
 */
async function generateTargetStructure(
    fileGroups: FileGroup[],
    targetPath: string,
): Promise<Map<string, string[]>> {
    const structure = new Map<string, string[]>();

    // ✅ 使用已经处理过的文件组，避免重复处理
    for (const group of fileGroups) {
        // 如果文件组还没有目标路径，则生成一个
        if (!group.targetPath) {
            logger.debug(`[import-worker] 为文件组生成目标路径: ${group.mainFile.name}`);
            // 使用主文件的日期生成路径，避免重复调用 processFileGroup
            const targetDate = group.mainFile.dateTime || group.mainFile.createdTime || new Date();
            group.targetPath = generateDatePath(targetDate);
        }

        if (group.targetPath) {
            const fullTargetPath = path.join(targetPath, group.targetPath);

            if (!structure.has(fullTargetPath)) {
                structure.set(fullTargetPath, []);
            }

            const fileNames = group.files.map((f) => f.name);
            structure.get(fullTargetPath)?.push(...fileNames);
        }
    }

    return structure;
}

// ==================== 导入执行逻辑 ====================

/**
 * 执行导入过程 - 使用策略模式
 */
async function executeImportProcess(
    config: ImportConfig,
    providedImportId?: string,
): Promise<ImportResult> {
    const importId = providedImportId || uuidv4();
    const startTime = Date.now();

    logger.debug(`[import-worker] 开始执行导入 ${importId} (provided: ${!!providedImportId})`);

    try {
        if (!Array.isArray(config.sourcePaths)) {
            logger.error(
                `[import-worker] config.sourcePaths 不是数组: ${typeof config.sourcePaths}, 值: ${JSON.stringify(config.sourcePaths)}`,
            );
            throw new Error("sourcePaths must be an array");
        }

        const fileGroups = await scanDirectoriesForFiles(config.sourcePaths, config.filters);

        const selectedGroups = filterSelectedFiles(fileGroups, config.selectedFiles);

        const result = await performFileImport(selectedGroups, config, importId);

        const duration = Date.now() - startTime;

        const finalResult = {
            ...result,
            duration,
            importId,
            sourcePaths: config.sourcePaths,
            targetPath: config.targetPath,
        };

        logger.debug(
            `[import-worker] executeImportProcess 最终结果: successful=${finalResult.successfulFiles}, skipped=${finalResult.skippedFiles}, errors=${finalResult.errorFiles}`,
        );

        return finalResult;
    } catch (error) {
        logger.error(`[import-worker] 导入执行失败: ${error}`);

        return createErrorResult(error, Date.now() - startTime, importId, config);
    }
}

/**
 * 创建错误结果 - 使用工厂模式
 */
function createErrorResult(
    error: unknown,
    duration: number,
    importId: string,
    config: ImportConfig,
): ImportResult {
    return {
        success: false,
        totalFiles: 0,
        successfulFiles: 0,
        skippedFiles: 0,
        errorFiles: 0,
        totalSize: 0,
        processedSize: 0,
        importedFiles: [],
        duplicateHandling: [],
        errors: [
            {
                id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                file: "",
                filePath: "",
                error: error instanceof Error ? error.message : "Unknown error",
                message: error instanceof Error ? error.message : "Unknown error",
                category: ErrorCategories.UNKNOWN,
                severity: ErrorSeverities.CRITICAL,
                recoverable: false,
                retryCount: 0,
            },
        ],
        warnings: [],
        duration,
        importId,
        sourcePaths: config.sourcePaths,
        targetPath: config.targetPath,
    };
}

/**
 * 过滤选中的文件 - 使用策略模式
 */
function filterSelectedFiles(fileGroups: FileGroup[], selectedFiles: string[]): FileGroup[] {
    logger.debug(
        `[import-worker] 过滤选中文件 - 文件组数: ${fileGroups.length}, 选中文件数: ${selectedFiles.length}`,
    );

    if (!selectedFiles || selectedFiles.length === 0) {
        logger.debug(`[import-worker] 没有指定选中文件，返回所有文件组`);
        const totalFiles = fileGroups.reduce((sum, group) => sum + group.files.length, 0);
        logger.debug(`[import-worker] 返回所有文件，总计 ${totalFiles} 个文件`);
        return fileGroups;
    }

    const selectedSet = new Set(selectedFiles);
    logger.debug(`[import-worker] 选中文件路径示例: ${selectedFiles.slice(0, 3).join(", ")}`);

    const filteredGroups = fileGroups.filter((group) => {
        const hasSelectedFiles = group.files.some((file) => selectedSet.has(file.path));
        if (hasSelectedFiles) {
            logger.debug(`[import-worker] 文件组 ${group.targetPath} 包含选中文件`);
        } else {
            logger.debug(
                `[import-worker] 文件组 ${group.targetPath} 不包含选中文件，文件示例: ${group.files
                    .slice(0, 2)
                    .map((f) => f.path)
                    .join(", ")}`,
            );
        }
        return hasSelectedFiles;
    });

    const filteredTotalFiles = filteredGroups.reduce((sum, group) => sum + group.files.length, 0);
    logger.debug(
        `[import-worker] 过滤后文件组数: ${filteredGroups.length}, 总文件数: ${filteredTotalFiles}`,
    );

    return filteredGroups;
}

/**
 * 执行实际的文件导入 - 使用策略模式
 */
async function performFileImport(
    fileGroups: FileGroup[],
    config: ImportConfig,
    importId = "default",
): Promise<Omit<ImportResult, "duration" | "importId" | "sourcePaths" | "targetPath">> {
    const importState = createImportState();
    const startTime = Date.now();

    // 计算总文件数
    const totalFiles = fileGroups.reduce((sum, group) => sum + group.files.length, 0);
    logger.debug(
        `[import-worker] 开始处理 ${totalFiles} 个文件，分布在 ${fileGroups.length} 个文件组中`,
    );

    // 发送初始进度事件
    sendProgressUpdate(importId, importState, totalFiles, "开始导入...", startTime);

    for (const group of fileGroups) {
        try {
            const processedGroup = await processFileGroup(group, logger);

            if (processedGroup.targetPath) {
                await processFileGroupImport(
                    processedGroup,
                    config,
                    importId,
                    importState,
                    startTime,
                    totalFiles,
                );
            }
        } catch (error) {
            await handleGroupError(group, error, importState, totalFiles);
        }
    }

    return createImportResult(importState);
}

/**
 * 创建导入状态 - 使用工厂模式
 */
function createImportState() {
    return {
        successfulFiles: 0,
        skippedFiles: 0,
        errorFiles: 0,
        totalSize: 0,
        importedFiles: [] as any[],
        errors: [] as any[],
        warnings: [] as any[],
        duplicateHandling: [] as any[],
    };
}

/**
 * 处理文件组导入 - 使用策略模式
 */
async function processFileGroupImport(
    processedGroup: FileGroup,
    config: ImportConfig,
    importId: string,
    importState: ReturnType<typeof createImportState>,
    startTime: number,
    totalFiles: number,
): Promise<void> {
    // 确保目标路径存在
    if (!processedGroup.targetPath) {
        throw new Error("Target path is required for file group");
    }
    const targetDir = path.join(config.targetPath, processedGroup.targetPath);
    await fs.ensureDir(targetDir);

    logger.debug(`[import-worker] 开始处理文件组，包含 ${processedGroup.files.length} 个文件`);

    for (const file of processedGroup.files) {
        try {
            const targetFilePath = path.join(targetDir, file.name);

            let finalTargetPath = targetFilePath;

            logger.debug(`[import-worker] 处理文件: ${file.name}, 目标路径: ${targetFilePath}`);

            if (await fs.pathExists(targetFilePath)) {
                logger.debug(`[import-worker] 检测到重复文件: ${targetFilePath}`);
                const handled = await handleDuplicateFile(
                    file,
                    targetFilePath,
                    config.duplicateStrategy,
                    config.useMD5ForDuplicates,
                );
                importState.duplicateHandling.push(handled);

                if (handled.action === DuplicateStrategies.SKIP) {
                    importState.skippedFiles++;
                    logger.debug(
                        `[import-worker] 文件跳过，当前统计 - 成功: ${importState.successfulFiles}, 跳过: ${importState.skippedFiles}, 错误: ${importState.errorFiles}`,
                    );
                    updateProgress(importId, importState, file.name, startTime, totalFiles);
                    continue;
                } else if (handled.action === DuplicateStrategies.RENAME && handled.newPath) {
                    finalTargetPath = handled.newPath;
                    logger.debug(`[import-worker] 使用重命名路径: ${finalTargetPath}`);
                } else if (handled.action === DuplicateStrategies.OVERWRITE) {
                    logger.debug(`[import-worker] 覆盖现有文件: ${finalTargetPath}`);
                }
            }

            await fs.copy(file.path, finalTargetPath, { preserveTimestamps: true });
            importState.successfulFiles++;
            importState.totalSize += file.size;

            logger.debug(
                `[import-worker] 文件导入成功，当前统计 - 成功: ${importState.successfulFiles}, 跳过: ${importState.skippedFiles}, 错误: ${importState.errorFiles}`,
            );

            importState.importedFiles.push({
                sourcePath: file.path,
                targetPath: finalTargetPath,
                size: file.size,
                importTime: new Date().toISOString(),
            });

            updateProgress(importId, importState, file.name, startTime, totalFiles);
            logger.debug(`[import-worker] 已导入: ${file.path} -> ${finalTargetPath}`);
        } catch (error) {
            await handleFileError(file, error, importState, startTime, importId, totalFiles);
        }
    }
}

/**
 * 更新进度 - 使用策略模式
 */
function updateProgress(
    importId: string,
    importState: ReturnType<typeof createImportState>,
    fileName: string,
    startTime: number,
    totalFiles: number,
): void {
    const processedFiles =
        importState.successfulFiles + importState.skippedFiles + importState.errorFiles;

    logger.debug(
        `[import-worker] Progress: ${processedFiles}/${totalFiles} files (successful: ${importState.successfulFiles}, skipped: ${importState.skippedFiles}, errors: ${importState.errorFiles}), current: ${fileName}`,
    );
    sendProgressUpdate(importId, importState, totalFiles, fileName, startTime);
}

/**
 * 处理文件错误 - 使用策略模式
 */
async function handleFileError(
    file: FileInfo,
    error: unknown,
    importState: ReturnType<typeof createImportState>,
    startTime: number,
    importId: string,
    totalFiles: number,
): Promise<void> {
    importState.errorFiles++;

    const serializableError = {
        id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        file: file.path,
        filePath: file.path,
        error: error instanceof Error ? error.message : "Unknown error",
        message: error instanceof Error ? error.message : "Unknown error",
        category: ErrorCategories.FILE_SYSTEM,
        severity: ErrorSeverities.HIGH,
        recoverable: false,
        retryCount: 0,
    };

    importState.errors.push(serializableError);
    updateProgress(importId, importState, file.name, startTime, totalFiles);
    logger.error(`[import-worker] 文件导入失败 ${file.path}: ${error}`);
}

/**
 * 处理组错误 - 使用策略模式
 */
async function handleGroupError(
    group: FileGroup,
    error: unknown,
    importState: ReturnType<typeof createImportState>,
    totalFiles: number,
): Promise<void> {
    importState.errorFiles += group.files.length;

    logger.error(
        `[import-worker] 文件组处理失败: ${group.mainFile.path}, 影响 ${group.files.length}/${totalFiles} 文件`,
    );

    const serializableError = {
        id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        file: group.mainFile.path,
        filePath: group.mainFile.path,
        error: error instanceof Error ? error.message : "Unknown error",
        message: error instanceof Error ? error.message : "Unknown error",
        category: ErrorCategories.FILE_SYSTEM,
        severity: ErrorSeverities.HIGH,
        recoverable: false,
        retryCount: 0,
    };

    importState.errors.push(serializableError);
    logger.error(`[import-worker] 文件组处理失败 ${group.mainFile.path}: ${error}`);
}

/**
 * 创建导入结果 - 使用工厂模式
 */
function createImportResult(importState: ReturnType<typeof createImportState>) {
    const totalFiles =
        importState.successfulFiles + importState.skippedFiles + importState.errorFiles;

    logger.debug(
        `[import-worker] 创建最终导入结果 - 成功: ${importState.successfulFiles}, 跳过: ${importState.skippedFiles}, 错误: ${importState.errorFiles}, 总计: ${totalFiles}`,
    );

    return {
        success: importState.errorFiles === 0,
        totalFiles,
        successfulFiles: importState.successfulFiles,
        skippedFiles: importState.skippedFiles,
        errorFiles: importState.errorFiles,
        totalSize: importState.totalSize,
        processedSize: importState.totalSize,
        importedFiles: importState.importedFiles,
        duplicateHandling: importState.duplicateHandling,
        errors: importState.errors,
        warnings: importState.warnings,
    };
}

/**
 * 处理重复文件 - 使用策略模式
 */
async function handleDuplicateFile(
    file: FileInfo,
    targetPath: string,
    strategy: string,
    useMD5?: boolean,
): Promise<any> {
    logger.debug(
        `[import-worker] 处理重复文件: ${file.name}, 策略: ${strategy}, MD5验证: ${useMD5}`,
    );

    try {
        const targetFile = await createTargetFileInfo(file, targetPath);
        const handler = DuplicateHandlerFactory.createHandler(strategy as any);
        const result = await handler.handle(targetFile, file, targetPath, { useMD5 });

        logger.debug(`[import-worker] 重复文件处理结果: ${result.action} - ${result.message}`);

        return {
            action: result.action,
            originalPath: result.originalPath || targetPath,
            newPath: result.newPath || targetPath,
            message: result.message || "Duplicate file handled",
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        logger.error(`[import-worker] 处理重复文件失败: ${error}`);

        return {
            action: DuplicateStrategies.SKIP,
            originalPath: targetPath,
            message: `Error handling duplicate, skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
    }
}

/**
 * 创建目标文件信息 - 使用工厂模式
 */
async function createTargetFileInfo(file: FileInfo, targetPath: string): Promise<FileInfo> {
    const stats = await fs.stat(targetPath);

    return {
        path: targetPath,
        name: path.basename(targetPath),
        size: stats.size,
        type: file.type,
        dateSource: DateSources.FILE_CREATED,
        modifiedTime: stats.mtime,
        createdTime: stats.birthtime,
        dateTime: stats.birthtime,
        file: targetPath,
        isImage: file.isImage,
        isVideo: file.isVideo,
        target: "",
        targetDir: "",
        targetFileName: "",
        targetFullPath: "",
    };
}
