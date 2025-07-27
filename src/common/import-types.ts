// 照片导入功能相关的类型定义
// 扩展现有的 FileAction 类型，添加文件组和元数据支持

import type { FileAction, ImportCallback } from "./types";

/**
 * 文件类型枚举
 */
export type FileType = "image" | "video" | "all";

/**
 * 日期来源类型
 */
export type DateSource = "exif" | "video_metadata" | "file_created";

/**
 * 重复文件处理策略
 */
export type DuplicateStrategy = "skip" | "rename" | "overwrite" | "keep_both";

/**
 * 重复文件处理动作
 */
export type DuplicateAction = "skip" | "rename" | "overwrite" | "keep_both";

/**
 * GPS信息
 */
export interface GPSInfo {
    latitude: number;
    longitude: number;
    altitude?: number | null;
}

/**
 * 相机信息
 */
export interface CameraInfo {
    make?: string | null;
    model?: string | null;
    lens?: string | null;
    iso?: number | null;
    focalLength?: number | null;
    aperture?: number | null;
    shutterSpeed?: number | null;
}

/**
 * 图片元数据
 */
export interface ImageMetadata {
    width: number;
    height: number;
    dateTime?: Date | null;
    gpsInfo?: GPSInfo | null;
    cameraInfo?: CameraInfo | null;
    format: string;
    dateSource: DateSource;
}

/**
 * 视频元数据
 */
export interface VideoMetadata {
    duration: number;
    creationTime?: Date | null;
    resolution: {
        width: number;
        height: number;
    };
    codec: string;
    gpsInfo?: GPSInfo | null;
    format: string;
    dateSource: DateSource;
}

/**
 * 扩展的文件信息（基于现有FileAction扩展）
 */
export interface FileInfo extends Omit<FileAction, "created"> {
    path: string;
    name: string;
    size: number;
    type: "image" | "video" | "other";
    metadata?: ImageMetadata | VideoMetadata;
    dateTime?: Date;
    dateSource: DateSource;
    modifiedTime?: Date;
    createdTime?: Date;
}

/**
 * 文件组类型
 */
export type FileGroupType = "single" | "group";

/**
 * 文件组
 */
export interface FileGroup {
    mainFile: FileInfo;
    files: FileInfo[];
    type: FileGroupType;
    totalSize: number;
    targetPath?: string;
}

/**
 * 导入过滤选项
 */
export interface ImportFilters {
    fileTypes: FileType[];
    sizeRange: { min: number; max: number };
    dateRange: { start: Date; end: Date };
    includeSubfolders: boolean;
    // 排除路径列表，用于忽略特定文件夹（如.photasaoriginal, .git等）
    excludePaths?: string[];
}

/**
 * 文件统计信息
 */
export interface FileStatistics {
    totalFiles: number;
    imageFiles: number;
    videoFiles: number;
    otherFiles: number;
    totalSize: number;
    duplicateCount: number;
    groupCount: number;
}

/**
 * 文件预览状态
 */
export interface FilePreviewState {
    files: FileGroup[];
    selectedFiles: Set<string>;
    totalSize: number;
    totalCount: number;
    statistics: FileStatistics;
    thumbnails: Map<string, string>;
    targetPaths: Map<string, string>;
}

/**
 * 导入配置
 */
export interface ImportConfig {
    sourcePaths: string[];
    targetPath: string;
    filters: ImportFilters;
    duplicateStrategy: DuplicateStrategy;
    fileGroups: FileGroup[];
    selectedFiles: string[];
    allowDuplicateRename: boolean;
}

/**
 * 导入错误信息
 */
export interface ImportError {
    file: string;
    error: string;
    code?: string;
    recoverable: boolean;
}

/**
 * 导入警告信息
 */
export interface ImportWarning {
    file: string;
    message: string;
    type: string;
}

/**
 * 导入进度信息
 */
export interface ImportProgress {
    totalFiles: number;
    processedFiles: number;
    currentFile?: string;
    speed: number; // files per second
    estimatedTimeRemaining: number; // seconds
    errors: ImportError[];
    warnings: ImportWarning[];
    status: "preparing" | "processing" | "paused" | "completed" | "cancelled" | "error";
}

/**
 * 批量导入进度
 */
export interface BatchProgress {
    totalDirectories: number;
    completedDirectories: number;
    currentDirectory: string;
    overallProgress: number;
}

/**
 * 目录进度
 */
export interface DirectoryProgress {
    path: string;
    totalFiles: number;
    processedFiles: number;
    status: "pending" | "processing" | "completed" | "paused" | "error";
    canCancel: boolean;
}

/**
 * 重复文件信息
 */
export interface DuplicateFileInfo {
    originalFile: FileInfo;
    duplicateFile: FileInfo;
    reason: string;
    action?: DuplicateAction;
}

/**
 * 文件比较结果
 */
export interface FileComparison {
    sizeDifference: number;
    timeDifference: number;
    recommendation: "keep_original" | "keep_duplicate" | "keep_both";
}

/**
 * 重复处理结果
 */
export interface DuplicateResult {
    action: DuplicateAction;
    originalPath: string;
    newPath?: string;
    comparison?: FileComparison;
    message: string;
}

/**
 * 文件导入信息
 */
export interface FileImportInfo {
    sourcePath: string;
    targetPath: string;
    size: number;
    checksum?: string;
    importTime: Date;
}

/**
 * 导入结果
 */
export interface ImportResult {
    success: boolean;
    totalFiles: number;
    successfulFiles: number;
    skippedFiles: number;
    errorFiles: number;
    totalSize: number;
    importedFiles: FileImportInfo[];
    duplicateHandling?: DuplicateResult[];
    errors: ImportError[];
    warnings: ImportWarning[];
    duration: number;
    importId: string;
    sourcePaths: string[];
    targetPath: string;
}

/**
 * 导入预览
 */
export interface ImportPreview {
    fileGroups: FileGroup[];
    statistics: FileStatistics;
    duplicates: DuplicateFileInfo[];
    estimatedDuration: number;
    targetStructure: Map<string, string[]>; // 目标目录结构预览
}

/**
 * 导入历史统计信息
 */
export interface ImportHistoryStatistics {
    totalFiles: number;
    successfulFiles: number;
    skippedFiles: number;
    errorFiles: number;
    totalSize: number;
    duplicateCount: number;
}

/**
 * 导入历史条目
 */
export interface ImportHistoryEntry {
    id: string;
    timestamp: Date;
    sourcePaths: string[];
    targetPath: string;
    result: ImportResult;
    canUndo: boolean;
    undoTimestamp?: Date;
    undoResult?: UndoResult;
    fileList: Array<{
        originalPath: string;
        targetPath: string;
        size: number;
        checksum: string | null;
        importTime: Date;
    }>;
    statistics: ImportHistoryStatistics;
}

/**
 * 导入历史记录
 */
export type ImportHistory = ImportHistoryEntry;

/**
 * 已导入文件信息
 */
export interface ImportedFileInfo {
    originalPath: string;
    targetPath: string;
    size: number;
    checksum: string | null; // 用于验证文件完整性
    importTime: Date;
}

/**
 * 撤销预览信息
 */
export interface UndoPreview {
    historyId: string;
    canUndo: boolean;
    reason: string;
    filesToDelete: Array<{
        path: string;
        size: number;
        originalPath: string;
        importTime: Date;
    }>;
    directoriesToCleanup: Set<string>;
    potentialIssues: Array<{
        file: string;
        issue: string;
        severity: "info" | "warning" | "error";
    }>;
    estimatedTime: number; // 预估撤销时间（秒）
}

/**
 * 撤销结果
 */
export interface UndoResult {
    success: boolean;
    deletedFiles: string[];
    errors: Array<{ file: string; error: string }>;
    restoredDirectories: Set<string>;
    undoId: string;
    timestamp: Date;
}

/**
 * 导入会话（用于恢复功能）
 */
export interface ImportSession {
    id: string;
    config: ImportConfig;
    status: "preparing" | "processing" | "paused" | "completed" | "cancelled" | "error";
    progress: ImportProgress;
    remainingFiles: FileGroup[];
    startTime: Date;
    pauseTime?: Date;
    resumeCount?: number;
    lastResumeTime?: Date;
    completionTime?: Date;
    cancelTime?: Date;
    finalResult?: ImportResult;
}

/**
 * Worker 通信类型
 */

/**
 * 元数据提取请求
 */
export interface MetadataRequest {
    filePath: string;
    fileType?: FileType;
}

/**
 * 文件元数据（统一类型）
 */
export interface FileMetadata {
    path: string;
    name: string;
    size: number;
    type: "image" | "video" | "other";
    modifiedTime: Date;
    createdTime: Date;
    dateTime?: Date;
    dateSource: DateSource;
    format?: string;
    width?: number;
    height?: number;
    duration?: number;
    gpsInfo?: GPSInfo;
    cameraInfo?: CameraInfo;
}

/**
 * 扫描目录请求
 */
export interface ScanDirectoriesRequest {
    paths: string[];
    filters?: ImportFilters;
}

/**
 * 导入请求（Worker通信）
 */
export interface ImportRequest {
    action:
        | "extract_metadata"
        | "process_file_group"
        | "scan_directories"
        | "execute_import"
        | "preview_import";
    payload: MetadataRequest | FileGroup | ScanDirectoriesRequest | ImportConfig;
}

/**
 * 导入响应（Worker通信）
 */
export interface ImportResponse {
    success: boolean;
    data?: FileMetadata | FileGroup[] | ImportResult | ImportPreview;
    error?: string;
}

/**
 * 扩展的导入回调（基于现有ImportCallback扩展）
 */
export interface EnhancedImportCallback {
    onProgress?: (progress: ImportProgress) => void;
    onDuplicateFound?: (duplicate: DuplicateFileInfo) => void;
    onFileGroupDetected?: (group: FileGroup) => void;
}

/**
 * 错误处理结果
 */
export interface ErrorHandlingResult {
    action: "skip" | "retry" | "pause" | "abort";
    reason: string;
    recoverable: boolean;
}

/**
 * 错误类型
 */
export type ErrorType =
    | "PERMISSION_DENIED"
    | "FILE_NOT_FOUND"
    | "DISK_FULL"
    | "NETWORK_ERROR"
    | "METADATA_ERROR"
    | "UNKNOWN";

/**
 * 恢复数据
 */
export interface ResumeData {
    sessions: ImportSession[];
    lastCleanup: Date;
}
