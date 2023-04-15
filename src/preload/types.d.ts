import { ElectronAPI } from "@electron-toolkit/preload";

type WatchAction = "add" | "change" | "delete" | "error" | "ready" | "raw";
type WatchCallback = (state: WatchState) => void;
type ImportCallback = (param: { type: string; action: FileAction }) => void;
type ScanCallback = (action: ScanArgs) => void;
type LoadCallback = (action: string, paths: string[]) => void;
type ConfigCallback = (action: string, paths: string[]) => void;

type PathName = "home" | "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";

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
    action: name;
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

interface VideoSize {
    width: number;
    height: number;
}

interface ScanAction {
    path: string;
    action: "scan" | "rescan" | "current"; // scan: new folder, rescan: existing folder, current: only current folder
    thumbnailSize: number = 100;
}

interface ScanArgs {
    type: "next" | "error" | "complete";
    requestId: string;
    action?: PhotoPath;
    error?: {
        message: string;
    };
}
interface ImageInfo {
    imageType: ImageTypeResult;
    tags: Tags | IccTags | XmpTags | undefined;
}

interface DirectorySelection {
    filePaths: string[];
}
interface WatchConfig {
    paths: string[];
}

interface WatchState {
    action?: WatchAction;
    isFile?: boolean;
    path?: string;
    error?: Error;
    isImage: boolean;
    isVideo: boolean;
    thumbnail: string;
    isNotify?: boolean;
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
            loadPhotasaConfigs: (paths: string[], callback: LoadCallback) => void;
            scanSubfolders: (folder: string) => Promise<string[]>;
            isFileUnderFolder: (file: string, folder: string) => boolean;
            toThumbnailName: (file: string) => string;
            toFileName: (file: string) => string;
            fixPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
            resetPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
            isHiddenFile: (fileName: string) => boolean;
            shouldIgnorePhotasaPath: (fileName: string) => boolean;
            isVideoFile: (filePath: string) => boolean;
            isImageFile: (filePath: string) => boolean;
        };
    }
}
