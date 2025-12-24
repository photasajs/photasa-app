/**
 * 司簿引擎数据契约定义
 * 根据RFC 0035规范定义
 */

/**
 * 监控配置文件
 */
export interface WatchProfile {
    id: string;
    rootPath: string;
    recursive: boolean;
    ignore?: string[];
    paused?: boolean;
    createdAt: number;
    updatedAt: number;
}

/**
 * 扫描策略
 */
export interface ScanPolicy {
    id: string;
    version: string;
    smartRefresh: {
        mtimeToleranceMs: number;
        hashThreshold?: number;
        thumbnailTtlMs: number;
        previewTtlMs: number;
    };
    queue: {
        maxParallel: number;
        backlogSoftLimit: number;
        retryLimit: number;
        backoffMs: number;
    };
    moveHandling: {
        crossProfileAsDelete: boolean;
        relocateAssets: boolean;
    };
    persistence: {
        dbPath: string;
        assetRoot: string;
    };
}

/**
 * 全局配置Manifest
 * 存储在应用配置目录
 */
export interface ConfigManifest {
    revision: string;
    updatedAt: number;
    profiles: WatchProfile[];
    scanPolicy: ScanPolicy;
    scanningFoldersSnapshot?: string[];
    syncState?: {
        provider: "none" | "icloud" | "webdav" | "s3" | "custom";
        endpoint?: string;
        accountId?: string;
        lastSyncedAt?: number;
        lastRemoteRevision?: string;
        status: "idle" | "syncing" | "error";
        errorCode?: string;
    };
    overrides?: Record<string, any>;
    history?: Array<{
        revision: string;
        actor: string;
        timestamp: number;
        summary: string;
    }>;
}

/**
 * 媒体索引条目
 */
export interface MediaIndexEntry {
    relativePath: string;
    checksum?: string;
    thumbnailPath?: string;
    previewPath?: string;
    lastModified: number;
    mediaType: "photo" | "video" | "other";
}

/**
 * 文件夹统计信息
 */
export interface FolderStats {
    fileCount: number;
    folderCount: number;
    lastFullScanAt?: number;
}

/**
 * 文件夹本地Manifest
 * 存储在 <folder>/.photasa.json
 */
export interface FolderManifest {
    folderId: string;
    revision: string;
    profileRevision: string;
    rootPath: string;
    mediaIndex: MediaIndexEntry[];
    subfolders: string[];
    stats: FolderStats;
    version: number;
}

/**
 * PreferenceStore同步快照
 */
export interface PreferenceSnapshot {
    revision: string;
    scanningFolders: string[];
    lastSyncedAt: number;
    dirty?: boolean;
}

/**
 * PreferenceStore增量变更
 */
export interface PreferenceDelta {
    baseRevision: string;
    payload: Partial<PreferenceSnapshot>;
    dirty: boolean;
}

/**
 * 配置验证结果
 */
export interface ValidationResult {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
}
