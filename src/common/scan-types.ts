/**
 * 照片文件请求类型
 */
export interface PhotoFileRequest {
    path: string;
    thumbnail: string;
    isImage: boolean;
    isVideo: boolean;
    isDirectory?: boolean;
}

/**
 * 扫描请求类型
 */
export interface ScanAction {
    path: string; // 扫描路径
    action: "scan" | "rescan" | "current"; // 扫描动作
    thumbnailSize: number; // 缩略图大小
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
