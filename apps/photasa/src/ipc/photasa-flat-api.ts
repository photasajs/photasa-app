/**
 * Typed surface for `window.api` / `getPhotasaApi()` until RFC 0097 retires legacy-api.ts.
 */
import type {
    DirectorySelection,
    FileGroup,
    FileMetadata,
    ImageInfo,
    ImportCallback,
    ImportConfig,
    ImportHistory,
    ImportPreview,
    ImportProgress,
    ImportResumeResult,
    ImportResult,
    PathName,
    PhotasaConfig,
    RecoverableImport,
    RecoverableImportActionResult,
    ScanAction,
    ScanArgs,
    UndoResult,
    WatchCallback,
    WatchConfig,
} from "@photasa/common";
import type { ImportFilters } from "@photasa/common";
import type { ThumbnailRequest, ThumbnailResponse } from "@renderer/api/thumbnail.adapter";

type Unsubscribe = () => void;

export interface PhotasaFlatApi {
    startWatching: (config: WatchConfig, callback: WatchCallback) => void;
    stopWatching: () => Promise<void>;
    importPhotos: (paths: string[], target: string, callback: ImportCallback) => void;
    chooseDirectory: () => Promise<DirectorySelection>;
    chooseDirectories: (multiSelect?: boolean) => Promise<DirectorySelection>;
    getDirectory: (name: PathName) => Promise<string | null>;
    createThumbnail: (request: ThumbnailRequest) => Promise<ThumbnailResponse>;
    removeThumbnail: (request: ThumbnailRequest) => Promise<ThumbnailResponse>;
    getImageType: (path: string) => Promise<ImageInfo>;
    getFileMetadata: (path: string) => Promise<FileMetadata>;
    scanPhotos: (scan: ScanAction) => Promise<ScanArgs>;
    addToPhotoList: (photoPath: string) => Promise<{ path: string; config: PhotasaConfig }>;
    removeFromPhotoList: (photoPath: string) => Promise<{ path: string; config: PhotasaConfig }>;
    getPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
    cleanupScanQueue: (folderPath: string) => void;
    scanSubfolders: (folder: string) => Promise<string[]>;
    checkPhotasaConfig: (
        folderPath: string,
    ) => Promise<{ hasConfig: boolean; photoCount?: number; reason: string }>;
    isFileUnderFolder: (file: string, folder: string) => boolean | Promise<boolean>;
    resetPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
    fixPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
    isVideoFile: (fileName: string) => boolean | Promise<boolean>;
    isImageFile: (fileName: string) => boolean | Promise<boolean>;
    scanDirectories: (paths: string[], filters?: ImportFilters) => Promise<FileGroup[]>;
    previewImport: (config: ImportConfig) => Promise<ImportPreview>;
    executeImport: (config: ImportConfig) => Promise<{ importId: string }>;
    onImportProgress: (callback: (progress: ImportProgress) => void) => Unsubscribe;
    onPreviewProgress: (callback: (progress: unknown, files?: unknown[]) => void) => Unsubscribe;
    onImportComplete: (callback: (result: ImportResult) => void) => Unsubscribe;
    onImportError: (callback: (error: unknown) => void) => Unsubscribe;
    removeImportListeners: () => void;
    cancelImport: (importId: string) => Promise<boolean>;
    pauseImport: (importId: string) => Promise<boolean>;
    resumeImport: (importId: string) => Promise<ImportResumeResult>;
    getImportHistory: (limit?: number) => Promise<ImportHistory[]>;
    getImportDetails: (historyId: string) => Promise<ImportHistory | null>;
    previewUndo: (historyId: string) => Promise<unknown>;
    undoImport: (historyId: string) => Promise<UndoResult>;
    getImportProgress: (importId: string) => Promise<ImportProgress>;
    getRecoverableImports: () => Promise<RecoverableImport[]>;
    cleanupRecoverableImport: (importId: string) => Promise<RecoverableImportActionResult>;
    keepRecoverableImport: (importId: string) => Promise<RecoverableImportActionResult>;
    relativePath: (from: string, to: string) => Promise<string> | string;
    resolvePath: (...segments: string[]) => Promise<string> | string;
    getRoot: (path: string) => Promise<string> | string;
    onUpdateAvailable?: (cb: (data: { version: string; info?: unknown }) => void) => Unsubscribe;
    onUpdateProgress?: (cb: (progress: number) => void) => Unsubscribe;
    onUpdateDownloaded?: (cb: (info?: unknown) => void) => Unsubscribe;
    onStatusChanged?: (cb: (status: unknown) => void) => Unsubscribe;
}
