/**
 * 自动更新配置接口
 */
export interface AutoUpdateConfig {
    enabled: boolean;
    checkInterval: number; // 检查间隔（小时）
    allowPrerelease: boolean;
    autoInstall: boolean;
    lastCheck?: string;
}

/**
 * 更新错误类型
 */
export enum UpdateErrorType {
    NETWORK = "network",
    CERTIFICATE = "certificate",
    DISK_SPACE = "disk_space",
    PERMISSION = "permission",
    FILE_INTEGRITY = "file_integrity",
    UNKNOWN = "unknown",
}

/**
 * 更新状态
 */
export type UpdateStatus =
    | "idle"
    | "checking"
    | "downloading"
    | "downloaded"
    | "error"
    | "upToDate";

/**
 * 更新进度信息
 */
export interface UpdateProgressInfo {
    status: UpdateStatus;
    progress?: number;
    error?: string;
    version?: string;
    info?: unknown; // legacy auto-updater的UpdateInfo类型
}

/**
 * 检查更新结果
 */
export interface UpdateCheckResult {
    hasUpdate: boolean;
    version?: string;
    info?: unknown;
}
