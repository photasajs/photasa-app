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
 * 扫描任务接口 - IPC通信契约（Renderer ↔ Main）
 *
 * @description
 * 这是renderer进程与main进程之间的IPC通信接口，定义了扫描请求的数据格式。
 * 此接口必须保持向后兼容，不能随意修改，因为main进程依赖这个契约。
 *
 * @important
 * - 这是IPC契约，不是Store内部的数据结构
 * - Store可以有自己的接口（包含状态机等字段）
 * - 修改此接口会影响renderer与main的通信
 *
 * @since RFC 0042 - IPC契约定义
 */
export interface ScanAction {
    /** 扫描路径 */
    path: string;

    /** 扫描动作类型 */
    action: "scan" | "rescan" | "current";

    /** 缩略图大小 */
    thumbnailSize: number;

    /** 操作类型（可选，用于区分文件和目录） */
    operationType?: "directory" | "file";

    /** 任务来源（可选，用于追踪任务来源） */
    source?: "user" | "auto";

    /** 时间戳（可选，用于排序） */
    timestamp?: number;

    /** 重试次数（可选，用于失败重试） */
    retryCount?: number;

    /** 任务优先级（可选，用于 UI 队列排序/展示，数值越小优先级越高） */
    priority?: number;

    /** 关联的文件操作ID（可选，用于追踪原始文件操作） */
    fileOperationId?: string;
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

/**
 * 扫描事件类型
 * @description 扫描事件类型，用于扫描事件和扫描任务
 */
export type ScanType = "action" | "progress" | "complete" | "error";

/**
 * 扫描动作基础类型
 * @description 扫描动作基础类型，用于扫描事件和扫描任务
 */
export interface BaseScanAction {
    path: string;
    isDirectory: boolean;
}

/**
 * 扫描事件类型（统一类型，用于 IPC 通信和内部事件）
 * @description 扫描worker通过IPC发送给renderer的事件，用于更新UI状态和folderTree
 * 统一了原 ScanActionEvent 和 FindPhotoEvent，消除重复定义
 */
export interface ScanActionEvent {
    /** 事件类型：进度更新、完成或错误 */
    type: ScanType;
    /** 请求ID，用于匹配请求和响应（IPC 事件必需） */
    requestId?: string;
    /** 扫描的路径信息 */
    action?: BaseScanAction;
    /** 扫描进度（已处理的文件数和总数） */
    progress?: {
        processed: number;
        total: number;
    };
    /** 当前正在处理的文件名 */
    currentFile?: string;
    /** 批量完成时的路径数组 */
    paths?: string[];
    /** 错误信息（错误事件时） */
    error?: unknown;
}

/**
 * @deprecated 使用 ScanActionEvent 替代
 * FindPhotoEvent 已与 ScanActionEvent 合并，保留此类型仅为向后兼容
 */
export type FindPhotoEvent = ScanActionEvent;
