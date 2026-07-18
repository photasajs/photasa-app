/**
 * 配置清单定义
 */
export interface ConfigManifest {
    revision: string; // 唯一版本号 (UUID)
    updatedAt: number; // 最后更新时间
    profiles: WatchProfile[]; // 监控配置/扫描方案
    scanPolicy?: ScanPolicy; // 扫描策略
    scanningFoldersSnapshot?: string[]; // 当前扫描的文件夹快照
    syncState?: SyncState; // 同步状态
    history?: MigrationRecord[]; // 变更历史
    overrides?: Record<string, any>; // 其他配置覆盖
}

/**
 * 监控配置/扫描方案 (此前为 ProfileManifest)
 */
export interface WatchProfile {
    id: string;
    rootPath: string; // 根目录路径
    recursive: boolean; // 是否递归
    ignore: string[]; // 忽略规则
    paused: boolean; // 是否暂停监控
    createdAt: number;
    updatedAt: number;
}

// 别名以保持兼容性
export type ProfileManifest = WatchProfile;

/**
 * 扫描策略
 */
export interface ScanPolicy {
    id: string;
    version: string;
    smartRefresh: {
        mtimeToleranceMs: number;
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
 * 同步状态
 */
export interface SyncState {
    provider: string;
    status: string;
    lastSync?: number;
    error?: string;
}

/**
 * 文件夹清单定义
 */
export interface FolderManifest {
    folderId: string; // 文件夹ID
    revision: string; // 版本号
    profileRevision: string; // 关联的配置版本
    rootPath: string; // 绝对路径
    mediaIndex: MediaIndexEntry[]; // 媒体索引
    subfolders: string[]; // 子目录列表
    stats: FolderStats; // 统计信息
    version: number; // 格式版本

    // 旧字段兼容
    path?: string;
    photos?: PhotoItem[];
    lastScanned?: number;
    hash?: string;
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
    mediaType: "image" | "video" | "other";
    size?: number;
    metadata?: any;
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
 * 照片项定义 (旧格式兼容)
 */
export interface PhotoItem {
    id: string; // 唯一ID
    name: string; // 文件名
    path: string; // 绝对路径
    size: number; // 文件大小
    mtime: number; // 修改时间
    metadata?: any; // 元数据 (可选)
}

/**
 * 迁移记录
 */
export interface MigrationRecord {
    revision: string;
    actor: string;
    timestamp: number;
    summary: string;
}
