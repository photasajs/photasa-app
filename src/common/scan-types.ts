export interface PhotoPath {
    path: string;
    thumbnail: string;
    isImage: boolean;
    isVideo: boolean;
}

/**
 * 照片文件请求类型 包含照片路径、缩略图、是否为图片、是否为视频、是否为目录
 */
export interface PhotoFileRequest extends PhotoPath {
    isDirectory?: boolean;
}
/**
 * File operation interface for unified queue processing
 * @description Represents a file system operation (add, change, delete) to be processed
 */
export interface FileOperation {
    id: string;
    type: "add" | "change" | "delete" | "addDir" | "deleteDir";
    path: string;
    timestamp: number;
    priority: number;
    retryCount: number;
    metadata?: {
        thumbnailSize: number;
        isFile: boolean;
        originalPath?: string; // for rename operations
        fileSize?: number;
        lastModified?: number;
    };
}

/**
 * Enhanced ScanAction interface with support for file operations and priority sorting
 * @description Unified interface for both directory scans and file operations with priority-based sorting
 */
export interface ScanAction {
    path: string; // 扫描路径
    action: "scan" | "rescan" | "current"; // 扫描动作
    thumbnailSize: number; // 缩略图大小

    // Priority sorting fields (RFC 0018)
    priority?: number; // 优先级（数值越小优先级越高）
    timestamp?: number; // 时间戳（用于相同优先级的排序）
    source?: "user" | "auto"; // 来源：用户手动添加或自动发现

    // Unified processing fields
    operationType?: "directory" | "file";
    retryCount?: number;
    fileOperationId?: string; // Link to FileOperation if applicable

    // Progress tracking for incremental cache
    progress?: {
        processed: number;
        total: number;
        cacheEnabled?: boolean;
    };
}

/**
 * Input interface for adding file operations to the scan queue
 * @description Represents the data needed to add a file operation to the persistent queue
 */
export interface FileOperationInput {
    /** File or directory path to process */
    path: string;
    /** Action to perform on the path */
    action: "scan" | "rescan" | "current";
    /** Thumbnail size for the operation */
    thumbnailSize: number;
    /** Type of operation - directory or file */
    operationType: "directory" | "file";

    // Priority sorting fields (RFC 0018) - optional for backward compatibility
    /** Priority for processing order (lower = higher priority) */
    priority?: number;
    /** Timestamp for sorting within same priority */
    timestamp?: number;
    /** Source of the operation */
    source?: "user" | "auto";

    /** Optional retry count for failed operations */
    retryCount?: number;
    /** Optional link to original FileOperation ID */
    fileOperationId?: string;
}

export interface ScanRequest {
    action: "scan";
    requestId: string; // 请求 ID
    scan: ScanAction; // 扫描动作
}

export interface ScanResult {
    path: string;
}

export interface ScanResponse {
    type: "scan" | "error" | "complete" | "progress";
    requestId: string;
    action?: PhotoFileRequest | ScanResult;
    progress?: {
        processed: number;
        total: number;
    };
    error?: string;
}

/**
 * 扫描参数
 */
export interface ScanArgs {
    type: "next" | "error" | "complete"; // 扫描类型
    requestId: string; // 请求 ID
    action?: PhotoFileRequest; // 照片路径
    error?: {
        message: string;
    };
}

/**
 * 扫描回调
 */
export type ScanCallback = (action: ScanArgs) => void;
