export interface PhotoItem {
    path: string;
    thumbnail?: string;
    history: string[];
    isVideo: boolean;
}

export interface PhotasaConfig {
    version: string;
    photoList: PhotoItem[];
    lastModified?: number;
}

export interface WatchConfig {
    path: string;
    recursive: boolean;
}

export interface WatchCallback {
    onAdd: (path: string) => void;
    onRemove: (path: string) => void;
}

export interface ImportCallback {
    onNext: (path: string) => void;
    onError: (error: string) => void;
    onComplete: () => void;
}

export interface DirectorySelection {
    path: string;
    name: string;
}

export type PathName = "import" | "target";

export interface ThumbnailRequest {
    path: string;
    thumbnail: string;
}

export interface ImageInfo {
    type: string;
    width: number;
    height: number;
}

export interface ScanAction {
    path: string;
    action: "scan" | "rescan" | "current";
    thumbnailSize: number;
}

export interface ScanArgs {
    path: string;
    action: "scan" | "rescan" | "current";
    thumbnailSize: number;
}

export interface Photo {
    path: string;
    thumbnail: string;
    isVideo: boolean;
    history: string[];
}

export interface API {
    startWatching: (config: WatchConfig, callback: WatchCallback) => void;
    stopWatching: () => Promise<void>;
    importPhotos: (paths: string[], target: string, callback: ImportCallback) => void;
    chooseDirectory: () => Promise<DirectorySelection>;
    getDirectory: (name: PathName) => Promise<string>;
    createThumbnail: (request: ThumbnailRequest) => Promise<ThumbnailRequest>;
    removeThumbnail: (request: ThumbnailRequest) => Promise<ThumbnailRequest>;
    getImageType: (path: string) => Promise<ImageInfo>;
    openInFinder: (path: string) => void;
    scanPhotos: (folder: ScanAction) => Promise<ScanArgs>;
    addToPhotoList: (photoPath: string) => Promise<{ path: string; config: PhotasaConfig }>;
    removeFromPhotoList: (photoPath: string) => Promise<{ path: string; config: PhotasaConfig }>;
    getPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
    scanSubfolders: (folder: string) => Promise<string[]>;
    isFileUnderFolder: (file: string, folder: string) => boolean;
    resetPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
    fixPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
    isHiddenFile: (fileName: string) => boolean;
    shouldIgnorePhotasaPath: (fileName: string) => boolean;
    isVideoFile: (fileName: string) => boolean;
    isImageFile: (fileName: string) => boolean;
    toFileName: (fileName: string) => string;
    toThumbnailName: (fileName: string) => string;
    shortenThumbnailName: (fileName: string) => string;
    fileUrlFromPath: (file: string) => string;
    cleanupScanQueue: (folderPath: string) => void;
}
