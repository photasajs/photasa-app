import type {
    ConfigManifest,
    FolderManifest,
    MediaWorkRequest,
    PreferenceSnapshot,
    ScanPolicy,
    ScanTask,
    WatchProfileConfig,
} from "./contracts";

const BASE_PROFILE_ID = "profile-default";
const BASE_PROFILE_REVISION = "rev-profile-20240607";

export const SAMPLE_WATCH_PROFILE: WatchProfileConfig = {
    id: BASE_PROFILE_ID,
    rootPath: "/Volumes/Photos/Library",
    recursive: true,
    ignoreGlobs: ["**/.trash/**", "**/*.tmp"],
    thumbnailSize: 320,
    autoStart: true,
    priority: "background",
    createdAt: 1_717_000_000_000,
    updatedAt: 1_717_000_000_000,
};

export const SAMPLE_SCAN_POLICY: ScanPolicy = {
    id: "scan-policy-default",
    version: "1.0.0",
    smartRefresh: {
        mtimeToleranceMs: 3000,
        hashThreshold: 5,
        thumbnailTtlMs: 1000 * 60 * 60 * 24 * 14, // 14 天
        previewTtlMs: 1000 * 60 * 60 * 24 * 30, // 30 天
    },
    queue: {
        maxParallel: 4,
        backlogSoftLimit: 200,
        retryLimit: 3,
        backoffMs: 1500,
    },
    moveHandling: {
        crossProfileAsDelete: true,
        relocateAssets: true,
    },
    persistence: {
        dbPath: "~/.photasa/db/scan.sqlite",
        assetRoot: "~/.photasa/assets",
    },
};

export const SAMPLE_CONFIG_MANIFEST: ConfigManifest = {
    revision: "rev-config-20240607",
    updatedAt: 1_717_000_500_000,
    profiles: [SAMPLE_WATCH_PROFILE],
    scanPolicy: SAMPLE_SCAN_POLICY,
    scanningFoldersSnapshot: [SAMPLE_WATCH_PROFILE.rootPath],
    syncState: {
        provider: "none",
        status: "idle",
    },
    overrides: {},
    history: [
        {
            revision: "rev-config-20240501",
            actor: "system",
            timestamp: 1_716_500_000_000,
            summary: "Initial configuration import",
        },
    ],
};

export const SAMPLE_FOLDER_MANIFEST: FolderManifest = {
    folderId: "folder-default",
    revision: "rev-folder-20240607",
    profileRevision: BASE_PROFILE_REVISION,
    rootPath: SAMPLE_WATCH_PROFILE.rootPath,
    mediaIndex: [
        {
            relativePath: "albums/2024/06/holiday.jpg",
            checksum: "sha1-abc123",
            thumbnailPath: "thumbnails/albums/2024/06/holiday.jpg.webp",
            previewPath: "previews/albums/2024/06/holiday.jpg.webp",
            lastModified: 1_717_000_100_000,
            mediaType: "photo",
        },
        {
            relativePath: "videos/2024/06/launch.mp4",
            checksum: "sha1-def456",
            thumbnailPath: "thumbnails/videos/2024/06/launch.mp4.webp",
            previewPath: "previews/videos/2024/06/launch.mp4.webp",
            lastModified: 1_717_000_120_000,
            mediaType: "video",
        },
    ],
    subfolders: ["albums/2024/06", "videos/2024/06"],
    stats: {
        fileCount: 2,
        folderCount: 2,
        lastFullScanAt: 1_717_000_400_000,
    },
    version: 1,
};

export const SAMPLE_SCAN_TASK: ScanTask = {
    id: "task-001",
    type: "InitialWalk",
    targetPath: SAMPLE_WATCH_PROFILE.rootPath,
    profileId: SAMPLE_WATCH_PROFILE.id,
    profileRevision: BASE_PROFILE_REVISION,
    requestedBy: "manual",
    priority: "user",
    hints: {
        forceRegenerate: false,
        thumbnailSize: SAMPLE_WATCH_PROFILE.thumbnailSize,
    },
    createdAt: 1_717_000_200_000,
};

export const SAMPLE_MEDIA_WORK_REQUEST: MediaWorkRequest = {
    id: "media-001",
    sourcePath: `${SAMPLE_WATCH_PROFILE.rootPath}/albums/2024/06/holiday.jpg`,
    outputKind: "thumbnail",
    options: {
        size: { width: 320, height: 320 },
        quality: 80,
        format: "webp",
    },
    profileId: SAMPLE_WATCH_PROFILE.id,
    profileRevision: BASE_PROFILE_REVISION,
    priority: "background",
    requestedBy: "qianliyan",
};

export const SAMPLE_PREFERENCE_SNAPSHOT: PreferenceSnapshot = {
    revision: SAMPLE_CONFIG_MANIFEST.revision,
    scanningFolders: [SAMPLE_WATCH_PROFILE.rootPath],
    lastSyncedAt: 1_717_000_500_500,
    dirty: false,
};
