// src/preload/types.ts
// 复制自 src/common/types.d.ts，供 preload 层类型引用

export interface VideoSize {
    width: number;
    height: number;
}

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

export interface FileAction {
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

export interface FileException {
    code?: string;
}

export interface PhotoAction {
    action: string;
    params: Record<string, object>;
    previous: string;
}

export interface Photo {
    path: string; // relative path
    thumbnail: string;
    isVideo: boolean;
    history: PhotoAction[];
}

export interface PhotoPath {
    path: string;
    thumbnail: string;
    isImage: boolean;
    isVideo: boolean;
}

export interface PhotasaConfig {
    version: string;
    photoList: Photo[];
    lastModified: number;
}

export interface PhotasaConfigResult {
    path: string;
    config: PhotasaConfig;
}

export interface ThumbnailRequest {
    path: string;
    thumbnail: string;
    width: number;
    height: number;
    always?: boolean;
    preview: string;
    withoutEnlargement?: boolean;
}

export interface ScanAction {
    path: string;
    action: "scan" | "rescan" | "current"; // scan: new folder, rescan: existing folder, current: only current folder
    thumbnailSize: number;
}

export interface ScanArgs {
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

export interface ImageInfo {
    imageType: ImageTypeResult;
    tags: Tags | IccTags | XmpTags | undefined;
}

export interface DirectorySelection {
    filePaths: string[];
}
