declare module "is-video";

interface VideoSize {
    width: number;
    height: number;
}

import { ElectronAPI } from "@electron-toolkit/preload";

export type WatchAction = "add" | "change" | "delete" | "error" | "ready" | "raw";

export interface WatchConfig {
    path: string;
    recursive: boolean;
    paths: string[];
}

export type WatchCallback = (state: WatchState) => void;

export interface WatchState {
    action: WatchAction;
    isFile: boolean;
    path: string;
    error?: Error;
    isImage: boolean;
    isVideo: boolean;
    thumbnail: string;
    isNotify?: boolean;
}

export type ImportCallback = (param: { type: string; error?: null; action: FileAction }) => void;
export type ScanCallback = (action: ScanArgs) => void;
export type LoadCallback = (action: string, paths: string[]) => void;
export type ConfigCallback = (action: string, paths: string[]) => void;

export type PathName =
    | "home"
    | "desktop"
    | "documents"
    | "downloads"
    | "music"
    | "pictures"
    | "videos";

interface FileAction {
    file: string;
    name: string;
    created?: Date;
    targetName?: string;
    isImage: boolean;
    isVideo: boolean;
    target?: string;
    targetDir: string;
    targetFileName: string;
    targetFullPath: string;
}

interface FileException {
    code?: string;
}

interface PhotoAction {
    action: string;
    params: Record<string, object>;
    previous: string;
}

interface Photo {
    path: string; // relative path
    thumbnail: string;
    isVideo: boolean;
    history: PhotoAction[];
}

interface PhotoPath {
    path: string;
    thumbnail: string;
    isImage: boolean;
    isVideo: boolean;
}

interface PhotasaConfig {
    version: string;
    photoList: Photo[];
    lastModified: number;
}

interface PhotasaConfigResult {
    path: string;
    config: PhotasaConfig;
}

interface ThumbnailRequest {
    path: string;
    thumbnail: string;
    width: number;
    height: number;
    always?: boolean;
    preview: string;
    withoutEnlargement?: boolean;
}

interface ScanAction {
    path: string;
    action: "scan" | "rescan" | "current"; // scan: new folder, rescan: existing folder, current: only current folder
    thumbnailSize: number;
}

interface ScanArgs {
    type: "next" | "error" | "complete";
    requestId: string;
    action?: PhotoPath;
    error?: {
        message: string;
    };
}

export type ImageTypeResult = "jpeg" | "png" | "gif" | "webp" | "tiff" | "unknown";
export type Tags = Record<string, any>;
export type IccTags = Record<string, any>;
export type XmpTags = Record<string, any>;

interface ImageInfo {
    imageType: ImageTypeResult;
    tags: Tags | IccTags | XmpTags | undefined;
}

interface DirectorySelection {
    filePaths: string[];
}

// contextBridge can only return few type, Promise is support, but rxjs is not.
declare global {
    interface Window {
        electron: ElectronAPI;
        __heic2any__worker: Worker;
        api: {
            startWatching: (config: WatchConfig, callback: WatchCallback) => void;
            stopWatching: () => Promise<void>;
            importPhotos: (paths: string[], target: string, callback: ImportCallback) => void;
            scanPhotos: (folder: ScanAction) => Promise<ScanArgs>;
            chooseDirectory: () => Promise<DirectorySelection>;
            getDirectory: (name: PathName) => Promise<string>;
            createThumbnail: (request: ThumbnailRequest) => Promise<ThumbnailRequest>;
            removeThumbnail: (request: ThumbnailRequest) => Promise<ThumbnailRequest>;
            getImageType: (path: string) => Promise<ImageInfo>;
            openInFinder: (path: string) => void;
            getPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
            addToPhotoList: (photo: string) => Promise<{ path: string; config: PhotasaConfig }>;
            removeFromPhotoList: (
                photo: string,
            ) => Promise<{ path: string; config: PhotasaConfig }>;
            scanSubfolders: (folder: string) => Promise<string[]>;
            isFileUnderFolder: (file: string, folder: string) => boolean;
            toThumbnailName: (file: string) => string;
            shortenThumbnailName: (file: string) => string;
            toFileName: (file: string) => string;
            fixPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
            resetPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
            isHiddenFile: (fileName: string) => boolean;
            shouldIgnorePhotasaPath: (fileName: string) => boolean;
            isVideoFile: (filePath: string) => boolean;
            isImageFile: (filePath: string) => boolean;
            fileUrlFromPath: (file: string) => string;
            cleanupScanQueue: (folderPath: string) => void;
        };
    }
}
