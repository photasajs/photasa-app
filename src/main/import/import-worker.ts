import { parentPort } from "worker_threads";
import { loggers } from "@common/logger";
import { createResponse } from "@common/worker-util";
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
import { extractMetadata, processFileGroup, FileGroupDetector } from "./import-handler";
import { DuplicateDetector, DuplicateHandlerFactory } from "./duplicate-handler";
import fs from "fs-extra";
import path from "path";
import isImage from "is-image";
import isVideo from "is-video";
import { v4 as uuidv4 } from "uuid";
import { shouldIgnorePhotasaPath } from "@common/utils";

const logger = loggers.worker;

/**
 * 导入Worker - 处理元数据提取、文件组检测和导入预览
 */
parentPort?.on("message", async (message: WorkerMessage<ImportRequest>) => {
    logger.debug(`[import-worker] 收到消息: ${JSON.stringify(message)}`);

    try {
        const { action } = message;

        switch (action) {
            case "extract_metadata":
                await handleExtractMetadata(message);
                break;

            case "process_file_group":
                await handleProcessFileGroup(message);
                break;

            case "scan_directories":
                await handleScanDirectories(message);
                break;

            case "preview_import":
                await handlePreviewImport(message);
                break;

            case "execute_import":
                await handleExecuteImport(message);
                break;

            default:
                logger.debug(`[import-worker] 未知操作: ${action}`);
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

/**
 * 处理元数据提取请求
 */
async function handleExtractMetadata(message: WorkerMessage<ImportRequest>): Promise<void> {
    const request = message.payload as unknown as MetadataRequest;
    logger.debug(`[import-worker] 提取元数据: ${request.filePath}`);

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
    logger.debug(`[import-worker] 处理文件组: ${group.mainFile.name}`);

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
    logger.debug(`[import-worker] 扫描目录: ${request.paths?.join(", ") || "无路径"}`);

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

    logger.debug(`[import-worker] 预览导入: ${config.sourcePaths?.join(", ") || "无源路径"}`);

    try {
        // 处理配置中的日期对象，安全地处理可能是字符串或 Date 的情况
        const processedConfig: ImportConfig = {
            ...config,
            filters: config.filters
                ? {
                      ...config.filters,
                      dateRange: config.filters.dateRange
                          ? {
                                start:
                                    config.filters.dateRange.start instanceof Date
                                        ? config.filters.dateRange.start
                                        : new Date(config.filters.dateRange.start),
                                end:
                                    config.filters.dateRange.end instanceof Date
                                        ? config.filters.dateRange.end
                                        : new Date(config.filters.dateRange.end),
                            }
                          : { start: new Date(0), end: new Date() },
                  }
                : {
                      fileTypes: [],
                      sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                      dateRange: { start: new Date(0), end: new Date() },
                      includeSubfolders: true,
                  },
        };

        const preview = await generateImportPreview(processedConfig);
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
    const config = request.payload as ImportConfig;
    logger.debug(`[import-worker] 执行导入: ${config.sourcePaths?.join(", ") || "无源路径"}`);

    try {
        // 处理配置中的日期对象，安全地处理可能是字符串或 Date 的情况
        const processedConfig: ImportConfig = {
            ...config,
            filters: config.filters
                ? {
                      ...config.filters,
                      dateRange: config.filters.dateRange
                          ? {
                                start:
                                    config.filters.dateRange.start instanceof Date
                                        ? config.filters.dateRange.start
                                        : new Date(config.filters.dateRange.start),
                                end:
                                    config.filters.dateRange.end instanceof Date
                                        ? config.filters.dateRange.end
                                        : new Date(config.filters.dateRange.end),
                            }
                          : { start: new Date(0), end: new Date() }, // 默认值
                  }
                : {
                      fileTypes: [],
                      sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                      dateRange: { start: new Date(0), end: new Date() },
                      includeSubfolders: true,
                  },
        };

        const result = await executeImportProcess(processedConfig);

        // 添加调试日志以检查 result 对象
        logger.debug(`[import-worker] Result object keys: ${Object.keys(result).join(", ")}`);
        logger.debug(
            `[import-worker] Result success: ${result.success}, totalFiles: ${result.totalFiles}`,
        );

        // 确保 result 对象是可序列化的
        const serializableResult = JSON.parse(JSON.stringify(result));

        const response = createResponse<ImportRequest, ImportResponse>(message, {
            success: true,
            data: serializableResult,
        });
        parentPort?.postMessage(response);
    } catch (error) {
        logger.error(`[import-worker] 导入执行失败: ${error}`);

        // 确保错误对象可以被序列化
        const serializableError =
            error instanceof Error
                ? {
                      message: error.message,
                      name: error.name,
                      stack: error.stack,
                      code: (error as any).code || undefined,
                  }
                : { message: String(error) };

        const response = createResponse<ImportRequest, ImportResponse>(message, {
            success: false,
            error: serializableError.message,
        });
        parentPort?.postMessage(response);
    }
}

/**
 * 扫描多个目录获取文件信息
 */
async function scanDirectoriesForFiles(paths: string[], filters?: any): Promise<FileGroup[]> {
    const allFiles: FileInfo[] = [];

    // 确保 paths 是一个数组
    if (!Array.isArray(paths)) {
        logger.error(
            `[import-worker] paths 不是数组: ${typeof paths}, 值: ${JSON.stringify(paths)}`,
        );
        return [];
    }

    for (const dirPath of paths) {
        logger.debug(`[import-worker] 扫描目录: ${dirPath}`);

        if (!(await fs.pathExists(dirPath))) {
            logger.warn(`[import-worker] 目录不存在: ${dirPath}`);
            continue;
        }

        const files = await scanSingleDirectory(dirPath, filters);
        allFiles.push(...files);
    }

    // 使用文件组检测器处理文件
    const detector = new FileGroupDetector();
    const fileGroups = detector.detectFileGroupsEnhanced(allFiles, logger);

    logger.debug(
        `[import-worker] 扫描完成，发现 ${allFiles.length} 个文件，${fileGroups.length} 个文件组`,
    );

    return fileGroups;
}

/**
 * 扫描单个目录
 */
async function scanSingleDirectory(dirPath: string, filters?: any): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            // 跳过photasa缓存路径
            if (shouldIgnorePhotasaPath(fullPath)) {
                continue;
            }

            if (entry.isDirectory()) {
                // 如果启用了子目录扫描
                if (filters?.includeSubfolders !== false) {
                    const subFiles = await scanSingleDirectory(fullPath, filters);
                    files.push(...subFiles);
                }
                continue;
            }

            if (entry.isFile()) {
                // 应用文件过滤器
                if (shouldIncludeFile(fullPath, filters)) {
                    const fileInfo = await createFileInfo(fullPath);
                    if (fileInfo) {
                        files.push(fileInfo);
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
 * 创建文件信息对象
 */
async function createFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
        const stats = await fs.stat(filePath);
        const fileName = path.basename(filePath);

        // 确定文件类型
        let fileType: "image" | "video" | "other" = "other";
        if (isImage(filePath)) {
            fileType = "image";
        } else if (isVideo(filePath)) {
            fileType = "video";
        }

        const fileInfo: FileInfo = {
            path: filePath,
            name: fileName,
            size: stats.size,
            type: fileType,
            dateSource: "file_created",
            modifiedTime: stats.mtime,
            createdTime: stats.birthtime,
            dateTime: stats.birthtime,
            // FileAction 兼容字段
            file: filePath,
            isImage: fileType === "image",
            isVideo: fileType === "video",
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
 * 检查文件是否应该包含在扫描结果中
 */
function shouldIncludeFile(filePath: string, filters?: any): boolean {
    const fileName = path.basename(filePath);

    // 跳过隐藏文件
    if (fileName.startsWith(".")) {
        return false;
    }

    // 跳过photasa缓存路径
    if (shouldIgnorePhotasaPath(filePath)) {
        return false;
    }

    // 应用文件类型过滤器
    if (filters?.fileTypes && filters.fileTypes.length > 0) {
        const hasAll = filters.fileTypes.includes("all");
        const hasImage = filters.fileTypes.includes("image") && isImage(filePath);
        const hasVideo = filters.fileTypes.includes("video") && isVideo(filePath);

        if (!hasAll && !hasImage && !hasVideo) {
            return false;
        }
    }

    // 应用文件大小过滤器
    if (filters?.sizeRange) {
        try {
            const stats = fs.statSync(filePath);
            if (stats.size < filters.sizeRange.min || stats.size > filters.sizeRange.max) {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    return true;
}

/**
 * 生成导入预览
 */
async function generateImportPreview(config: ImportConfig): Promise<ImportPreview> {
    logger.debug(`[import-worker] 生成导入预览`);

    // 确保 sourcePaths 是一个数组
    if (!Array.isArray(config.sourcePaths)) {
        logger.error(
            `[import-worker] config.sourcePaths 不是数组: ${typeof config.sourcePaths}, 值: ${JSON.stringify(config.sourcePaths)}`,
        );
        throw new Error("sourcePaths must be an array");
    }

    // 扫描源目录
    const rawFileGroups = await scanDirectoriesForFiles(config.sourcePaths, config.filters);

    // 处理文件组以提取元数据和设置目标路径
    const fileGroups: FileGroup[] = [];
    for (const group of rawFileGroups) {
        const processedGroup = await processFileGroup(group, logger);
        fileGroups.push(processedGroup);
    }

    // 计算统计信息
    const statistics = calculateFileStatistics(fileGroups);

    // 检测重复文件
    const duplicates = await detectDuplicateFiles(fileGroups, config.targetPath);

    // 估算导入时间
    const estimatedDuration = estimateImportDuration(fileGroups);

    // 生成目标结构预览
    const targetStructure = await generateTargetStructure(fileGroups, config.targetPath);

    return {
        fileGroups,
        statistics,
        duplicates,
        estimatedDuration,
        targetStructure,
    };
}

/**
 * 计算文件统计信息
 */
function calculateFileStatistics(fileGroups: FileGroup[]): FileStatistics {
    let totalFiles = 0;
    let imageFiles = 0;
    let videoFiles = 0;
    let otherFiles = 0;
    let totalSize = 0;
    let groupCount = 0;

    for (const group of fileGroups) {
        totalFiles += group.files.length;
        totalSize += group.totalSize;

        if (group.type === "group") {
            groupCount++;
        }

        for (const file of group.files) {
            switch (file.type) {
                case "image":
                    imageFiles++;
                    break;
                case "video":
                    videoFiles++;
                    break;
                default:
                    otherFiles++;
                    break;
            }
        }
    }

    return {
        totalFiles,
        imageFiles,
        videoFiles,
        otherFiles,
        totalSize,
        duplicateCount: 0, // 将在重复检测中更新
        groupCount,
    };
}

/**
 * 检测重复文件
 */
async function detectDuplicateFiles(
    fileGroups: FileGroup[],
    targetPath: string,
): Promise<DuplicateFileInfo[]> {
    logger.debug(`[import-worker] 检测重复文件，目标路径: ${targetPath}`);

    const detector = new DuplicateDetector();
    const duplicates = await detector.detectDuplicates(fileGroups, targetPath);

    logger.debug(`[import-worker] 检测到 ${duplicates.length} 个重复文件`);
    return duplicates;
}

/**
 * 估算导入时间
 */
function estimateImportDuration(fileGroups: FileGroup[]): number {
    const totalSize = fileGroups.reduce((sum, group) => sum + group.totalSize, 0);
    const totalFiles = fileGroups.reduce((sum, group) => sum + group.files.length, 0);

    // 简单的时间估算：基于文件大小和数量
    // 假设处理速度：100MB/s + 每个文件0.1秒的固定开销
    const sizeBasedTime = totalSize / (100 * 1024 * 1024); // 100MB/s
    const fileBasedTime = totalFiles * 0.1; // 每个文件0.1秒

    return Math.max(sizeBasedTime + fileBasedTime, 1); // 至少1秒
}

/**
 * 生成目标结构预览
 */
async function generateTargetStructure(
    fileGroups: FileGroup[],
    targetPath: string,
): Promise<Map<string, string[]>> {
    const structure = new Map<string, string[]>();

    for (const group of fileGroups) {
        // 处理文件组以获取目标路径
        const processedGroup = await processFileGroup(group, logger);

        if (processedGroup.targetPath) {
            const fullTargetPath = path.join(targetPath, processedGroup.targetPath);

            if (!structure.has(fullTargetPath)) {
                structure.set(fullTargetPath, []);
            }

            const fileNames = processedGroup.files.map((f) => f.name);
            structure.get(fullTargetPath)?.push(...fileNames);
        }
    }

    return structure;
}

/**
 * 执行导入过程
 */
async function executeImportProcess(config: ImportConfig): Promise<ImportResult> {
    const importId = uuidv4();
    const startTime = Date.now();

    logger.debug(`[import-worker] 开始执行导入 ${importId}`);

    try {
        // 确保 sourcePaths 是一个数组
        if (!Array.isArray(config.sourcePaths)) {
            logger.error(
                `[import-worker] config.sourcePaths 不是数组: ${typeof config.sourcePaths}, 值: ${JSON.stringify(config.sourcePaths)}`,
            );
            throw new Error("sourcePaths must be an array");
        }

        // 扫描文件
        const fileGroups = await scanDirectoriesForFiles(config.sourcePaths, config.filters);

        // 过滤选中的文件
        const selectedGroups = filterSelectedFiles(fileGroups, config.selectedFiles);

        // 执行实际的文件复制操作
        const result = await performFileImport(selectedGroups, config);

        const duration = Date.now() - startTime;

        return {
            ...result,
            duration,
            importId,
            sourcePaths: config.sourcePaths,
            targetPath: config.targetPath,
        };
    } catch (error) {
        logger.error(`[import-worker] 导入执行失败: ${error}`);

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
                    category: "UNKNOWN" as const,
                    severity: "CRITICAL" as const,
                    recoverable: false,
                    retryCount: 0,
                },
            ],
            warnings: [],
            duration: Date.now() - startTime,
            importId,
            sourcePaths: config.sourcePaths,
            targetPath: config.targetPath,
        };
    }
}

/**
 * 过滤选中的文件
 */
function filterSelectedFiles(fileGroups: FileGroup[], selectedFiles: string[]): FileGroup[] {
    if (selectedFiles.length === 0) {
        return fileGroups; // 如果没有选择，返回所有文件
    }

    const selectedSet = new Set(selectedFiles);
    return fileGroups.filter((group) => group.files.some((file) => selectedSet.has(file.path)));
}

/**
 * 执行实际的文件导入
 */
async function performFileImport(
    fileGroups: FileGroup[],
    config: ImportConfig,
): Promise<Omit<ImportResult, "duration" | "importId" | "sourcePaths" | "targetPath">> {
    let successfulFiles = 0;
    let skippedFiles = 0;
    let errorFiles = 0;
    const importedFiles: any[] = [];
    const errors: any[] = [];
    const warnings: any[] = [];
    const duplicateHandling: any[] = [];

    const totalFiles = fileGroups.reduce((sum, group) => sum + group.files.length, 0);
    let totalSize = 0;

    for (const group of fileGroups) {
        try {
            // 处理文件组以获取目标路径
            const processedGroup = await processFileGroup(group, logger);

            if (processedGroup.targetPath) {
                const targetDir = path.join(config.targetPath, processedGroup.targetPath);

                // 确保目标目录存在
                await fs.ensureDir(targetDir);

                // 复制文件组中的所有文件
                for (const file of processedGroup.files) {
                    try {
                        const targetFilePath = path.join(targetDir, file.name);

                        // 检查重复文件
                        if (await fs.pathExists(targetFilePath)) {
                            // 根据重复策略处理
                            const handled = await handleDuplicateFile(
                                file,
                                targetFilePath,
                                config.duplicateStrategy,
                            );
                            duplicateHandling.push(handled);

                            if (handled.action === "skip") {
                                skippedFiles++;
                                continue;
                            }
                        }

                        // 复制文件
                        await fs.copy(file.path, targetFilePath, { preserveTimestamps: true });
                        successfulFiles++;
                        totalSize += file.size;

                        // 记录导入的文件信息
                        importedFiles.push({
                            sourcePath: file.path,
                            targetPath: targetFilePath,
                            size: file.size,
                            importTime: new Date().toISOString(),
                        });

                        logger.debug(`[import-worker] 已导入: ${file.path} -> ${targetFilePath}`);
                    } catch (error) {
                        errorFiles++;

                        // 创建可序列化的错误对象
                        const serializableError = {
                            id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                            file: file.path,
                            filePath: file.path,
                            error: error instanceof Error ? error.message : "Unknown error",
                            message: error instanceof Error ? error.message : "Unknown error",
                            category: "FILE_SYSTEM" as const,
                            severity: "HIGH" as const,
                            recoverable: false,
                            retryCount: 0,
                        };

                        errors.push(serializableError);
                        logger.error(`[import-worker] 文件导入失败 ${file.path}: ${error}`);
                    }
                }
            }
        } catch (error) {
            errorFiles += group.files.length;

            // 创建可序列化的错误对象
            const serializableError = {
                id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                file: group.mainFile.path,
                filePath: group.mainFile.path,
                error: error instanceof Error ? error.message : "Unknown error",
                message: error instanceof Error ? error.message : "Unknown error",
                category: "FILE_SYSTEM" as const,
                severity: "HIGH" as const,
                recoverable: false,
                retryCount: 0,
            };

            errors.push(serializableError);
            logger.error(`[import-worker] 文件组处理失败 ${group.mainFile.path}: ${error}`);
        }
    }

    return {
        success: errorFiles === 0,
        totalFiles,
        successfulFiles,
        skippedFiles,
        errorFiles,
        totalSize,
        processedSize: totalSize,
        importedFiles,
        duplicateHandling,
        errors,
        warnings,
    };
}

/**
 * 处理重复文件
 */
async function handleDuplicateFile(
    file: FileInfo,
    targetPath: string,
    strategy: string,
): Promise<any> {
    logger.debug(`[import-worker] 处理重复文件: ${file.name}, 策略: ${strategy}`);

    try {
        // 创建目标文件的FileInfo对象
        const stats = await fs.stat(targetPath);
        const targetFile: FileInfo = {
            path: targetPath,
            name: path.basename(targetPath),
            size: stats.size,
            type: file.type,
            dateSource: "file_created",
            modifiedTime: stats.mtime,
            createdTime: stats.birthtime,
            dateTime: stats.birthtime,
            // FileAction 兼容字段
            file: targetPath,
            isImage: file.isImage,
            isVideo: file.isVideo,
            target: "",
            targetDir: "",
            targetFileName: "",
            targetFullPath: "",
        };

        // 使用DuplicateHandlerFactory创建处理器
        const handler = DuplicateHandlerFactory.createHandler(strategy as any);
        const result = await handler.handle(targetFile, file, targetPath);

        logger.debug(`[import-worker] 重复文件处理结果: ${result.action} - ${result.message}`);

        // 确保返回可序列化的对象，避免克隆错误
        return {
            action: result.action,
            originalPath: result.originalPath || targetPath,
            newPath: result.newPath || targetPath,
            message: result.message || "Duplicate file handled",
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        logger.error(`[import-worker] 处理重复文件失败: ${error}`);

        // 回退到跳过策略
        return {
            action: "skip",
            originalPath: targetPath,
            message: `Error handling duplicate, skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
    }
}
