import { v4 as uuidv4 } from "uuid";
import type { PhotasaLogger } from "@photasa/common";
import type { PhotasaConfig } from "@photasa/common";
import type {
    ConfigManifest,
    FolderManifest,
    WatchProfile,
    ScanPolicy,
    MediaIndexEntry,
    FolderStats,
} from "../types/manifests";

/**
 * 生成新的revision
 * 格式：UUID-时间戳
 */
export function generateRevision(): string {
    return `${uuidv4()}-${Date.now()}`;
}

/**
 * 规范化全局配置Manifest
 */
export function normalizeConfigManifest(
    raw: Partial<ConfigManifest>,
    _logger?: PhotasaLogger,
): ConfigManifest {
    return {
        revision: raw.revision || generateRevision(),
        updatedAt: raw.updatedAt || Date.now(),
        profiles: normalizeWatchProfiles(raw.profiles),
        scanPolicy: normalizeScanPolicy(raw.scanPolicy),
        scanningFoldersSnapshot: raw.scanningFoldersSnapshot || [],
        syncState: raw.syncState || {
            provider: "none",
            status: "idle",
        },
        overrides: raw.overrides || {},
        history: raw.history || [],
    };
}

/**
 * 规范化监控配置文件列表
 */
function normalizeWatchProfiles(profiles?: WatchProfile[]): WatchProfile[] {
    if (!Array.isArray(profiles)) {
        return [];
    }
    return profiles
        .map((profile) => ({
            id: profile.id || uuidv4(),
            rootPath: profile.rootPath || "",
            recursive: profile.recursive !== false,
            ignore: profile.ignore || [],
            paused: profile.paused || false,
            createdAt: profile.createdAt || Date.now(),
            updatedAt: profile.updatedAt || Date.now(),
        }))
        .filter((profile) => profile.rootPath.length > 0);
}

/**
 * 规范化扫描策略
 */
function normalizeScanPolicy(policy?: Partial<ScanPolicy>): ScanPolicy {
    const defaultPolicy: ScanPolicy = {
        id: "default",
        version: "1.0.0",
        smartRefresh: {
            mtimeToleranceMs: 1000,
            thumbnailTtlMs: 30 * 24 * 60 * 60 * 1000, // 30天
            previewTtlMs: 7 * 24 * 60 * 60 * 1000, // 7天
        },
        queue: {
            maxParallel: 5,
            backlogSoftLimit: 1000,
            retryLimit: 3,
            backoffMs: 1000,
        },
        moveHandling: {
            crossProfileAsDelete: false,
            relocateAssets: true,
        },
        persistence: {
            dbPath: ".photasa",
            assetRoot: ".photasaoriginals",
        },
    };

    if (!policy) {
        return defaultPolicy;
    }

    return {
        id: policy.id || defaultPolicy.id,
        version: policy.version || defaultPolicy.version,
        smartRefresh: {
            ...defaultPolicy.smartRefresh,
            ...policy.smartRefresh,
        },
        queue: {
            ...defaultPolicy.queue,
            ...policy.queue,
        },
        moveHandling: {
            ...defaultPolicy.moveHandling,
            ...policy.moveHandling,
        },
        persistence: {
            ...defaultPolicy.persistence,
            ...policy.persistence,
        },
    };
}

/**
 * 规范化文件夹Manifest
 */
export function normalizeFolderManifest(
    raw: Partial<FolderManifest>,
    _logger?: PhotasaLogger,
): FolderManifest {
    return {
        folderId: raw.folderId || uuidv4(),
        revision: raw.revision || generateRevision(),
        profileRevision: raw.profileRevision || "",
        rootPath: raw.rootPath || "",
        mediaIndex: normalizeMediaIndex(raw.mediaIndex),
        subfolders: raw.subfolders || [],
        stats: normalizeStats(raw.stats),
        version: raw.version || 1,
    };
}

/**
 * 规范化媒体索引
 */
function normalizeMediaIndex(index?: MediaIndexEntry[]): MediaIndexEntry[] {
    if (!Array.isArray(index)) {
        return [];
    }
    return index
        .filter(
            (entry) =>
                entry && typeof entry.relativePath === "string" && entry.relativePath.length > 0,
        )
        .map((entry) => ({
            relativePath: entry.relativePath,
            checksum: entry.checksum,
            thumbnailPath: entry.thumbnailPath,
            previewPath: entry.previewPath,
            lastModified: entry.lastModified || 0,
            mediaType: entry.mediaType || "other",
        }));
}

/**
 * 规范化统计信息
 */
function normalizeStats(stats?: Partial<FolderStats>): FolderStats {
    return {
        fileCount: stats?.fileCount || 0,
        folderCount: stats?.folderCount || 0,
        lastFullScanAt: stats?.lastFullScanAt,
    };
}

/**
 * 创建空的全局配置Manifest
 */
export function createEmptyConfigManifest(): ConfigManifest {
    return normalizeConfigManifest({});
}

/**
 * 创建空的文件夹Manifest
 */
export function createEmptyFolderManifest(rootPath: string): FolderManifest {
    return normalizeFolderManifest({ rootPath });
}

// === 旧版本兼容函数 ===

/**
 * 创建空的旧版本配置（向后兼容）
 */
export function createEmptyManifest(): PhotasaConfig {
    return {
        version: "1.0",
        photoList: [],
        lastModified: Date.now(),
    };
}

/**
 * 规范化旧版本配置（向后兼容）
 */
export function normalizeManifest(
    raw: Partial<PhotasaConfig>,
    _logger?: PhotasaLogger,
): PhotasaConfig {
    return {
        version: raw.version || "1.0",
        photoList: Array.isArray(raw.photoList) ? raw.photoList : [],
        lastModified: raw.lastModified || Date.now(),
    };
}
