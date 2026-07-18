/**
 * Engine collaboration contracts shared across
 * Shunfenger, Qianliyan, Sibu, and MaLiang.
 *
 * Phase 0 将这些接口固化为单一事实来源，
 * 后续引擎只需引用本文件即可保持契约一致。
 */

export type ObservationKind = "add" | "change" | "delete" | "addDir" | "deleteDir" | "move";

export interface FileObservationMetadata {
    size?: number;
    mtimeMs?: number;
    ctimeMs?: number;
    hash?: string;
    pairedWith?: string;
    rawArgs?: unknown[];
}

export interface FileObservation {
    id: string;
    path: string;
    kind: ObservationKind;
    isDirectory: boolean;
    isMediaFile: boolean;
    detectedAt: number;
    sourceProfileId: string;
    profileRevision: string;
    metadata?: FileObservationMetadata;
}

export type ScanTaskType =
    | "InitialWalk"
    | "IncrementalFolder"
    | "FileRefresh"
    | "DeleteCleanup"
    | "MoveRewrite";

export type TaskPriority = "user" | "background";

export interface ScanTaskHints {
    forceRegenerate?: boolean;
    thumbnailSize?: number;
    skipDbTouch?: boolean;
}

export interface ScanTask {
    id: string;
    type: ScanTaskType;
    targetPath: string;
    profileId: string;
    profileRevision: string;
    requestedBy: "manual" | "watch" | "system";
    priority: TaskPriority;
    hints?: ScanTaskHints;
    createdAt: number;
}

export interface ScanPolicySmartRefresh {
    mtimeToleranceMs: number;
    hashThreshold?: number;
    thumbnailTtlMs: number;
    previewTtlMs: number;
}

export interface ScanPolicyQueueConfig {
    maxParallel: number;
    backlogSoftLimit: number;
    retryLimit: number;
    backoffMs: number;
}

export interface ScanPolicyMoveHandling {
    crossProfileAsDelete: boolean;
    relocateAssets: boolean;
}

export interface ScanPolicyPersistence {
    dbPath: string;
    assetRoot: string;
}

export interface ScanPolicy {
    id: string;
    version: string;
    smartRefresh: ScanPolicySmartRefresh;
    queue: ScanPolicyQueueConfig;
    moveHandling: ScanPolicyMoveHandling;
    persistence: ScanPolicyPersistence;
}

export type MediaWorkKind = "thumbnail" | "preview" | "metadata" | "transcode";

export interface MediaWorkRequestOptions {
    size?: { width: number; height: number };
    quality?: number;
    format?: string;
}

export interface MediaWorkRequest {
    id: string;
    sourcePath: string;
    outputKind: MediaWorkKind;
    options?: MediaWorkRequestOptions;
    profileId: string;
    profileRevision: string;
    priority: TaskPriority;
    requestedBy: string;
}

export interface WatchProfileConfig {
    id: string;
    rootPath: string;
    recursive: boolean;
    ignoreGlobs: string[];
    thumbnailSize: number;
    autoStart: boolean;
    priority: TaskPriority;
    createdAt: number;
    updatedAt: number;
}

export type SyncProvider = "none" | "icloud" | "webdav" | "s3" | "custom";

export interface ConfigSyncState {
    provider: SyncProvider;
    endpoint?: string;
    accountId?: string;
    lastSyncedAt?: number;
    lastRemoteRevision?: string;
    status: "idle" | "syncing" | "error";
    errorCode?: string;
}

export interface ConfigManifestHistoryEntry {
    revision: string;
    actor: string;
    timestamp: number;
    summary: string;
}

export interface ConfigManifest {
    revision: string;
    updatedAt: number;
    profiles: WatchProfileConfig[];
    scanPolicy: ScanPolicy;
    scanningFoldersSnapshot?: string[];
    syncState?: ConfigSyncState;
    overrides?: Record<string, unknown>;
    history?: ConfigManifestHistoryEntry[];
}

export interface FolderManifestIndex {
    folderId: string;
    rootPath: string;
    manifestPath: string;
    lastSeenRevision: string;
    mediaStats?: {
        assetCount: number;
        lastScannedAt?: number;
    };
}

export interface FolderMediaIndexEntry {
    relativePath: string;
    checksum?: string;
    thumbnailPath?: string;
    previewPath?: string;
    lastModified: number;
    mediaType: "photo" | "video" | "other";
}

export interface FolderManifestStats {
    fileCount: number;
    folderCount: number;
    lastFullScanAt?: number;
}

export interface FolderManifest {
    folderId: string;
    revision: string;
    profileRevision: string;
    rootPath: string;
    mediaIndex: FolderMediaIndexEntry[];
    subfolders: string[];
    stats: FolderManifestStats;
    version: number;
}

export interface PreferenceSnapshot {
    revision: string;
    scanningFolders: string[];
    lastSyncedAt: number;
    dirty?: boolean;
}

export type WatcherStatusState = "initializing" | "ready" | "paused" | "error" | "flushing";

export interface WatcherStatusEvent {
    type: "watcher";
    state: WatcherStatusState;
    profileId?: string;
    pendingEvents?: number;
    backlogSize?: number;
    message?: string;
    error?: Error;
    timestamp: number;
}

export type ScanStatusState =
    | "queued"
    | "running"
    | "media-processing"
    | "db-sync"
    | "completed"
    | "skipped"
    | "failed";

export interface ScanStatusProgress {
    processed: number;
    total?: number;
    currentPath?: string;
}

export interface ScanStatusEvent {
    type: "scan";
    taskId: string;
    profileId: string;
    state: ScanStatusState;
    progress?: ScanStatusProgress;
    error?: Error;
    timestamp: number;
}

export type MediaStatusState = "queued" | "processing" | "completed" | "failed";

export interface MediaStatusEvent {
    type: "media";
    requestId: string;
    profileId: string;
    state: MediaStatusState;
    outputs?: string[];
    error?: Error;
    durationMs?: number;
    timestamp: number;
}

export type ConfigStatusType =
    | "initialized"
    | "updated"
    | "preferenceSynced"
    | "conflict"
    | "error";

export interface ConfigStatusEvent {
    type: "config";
    status: ConfigStatusType;
    revision: string;
    message?: string;
    error?: Error;
    timestamp: number;
}

export type EngineStatusEvent =
    | WatcherStatusEvent
    | ScanStatusEvent
    | MediaStatusEvent
    | ConfigStatusEvent;

/**
 * 简易断言，帮助在运行时校验对象是否具备核心字段。
 */
export function assertValidFileObservation(observation: FileObservation): void {
    if (!observation.id || !observation.path) {
        throw new Error("FileObservation 缺少 id 或 path");
    }
    if (!observation.sourceProfileId) {
        throw new Error("FileObservation 缺少 sourceProfileId");
    }
    if (!observation.profileRevision) {
        throw new Error("FileObservation 缺少 profileRevision");
    }
}

export function assertValidFolderManifest(manifest: FolderManifest): void {
    if (!manifest.folderId || !manifest.revision) {
        throw new Error("FolderManifest 缺少 folderId 或 revision");
    }
    if (!manifest.rootPath) {
        throw new Error("FolderManifest 缺少 rootPath");
    }
}
