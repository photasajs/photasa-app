import { ElectronAPI } from "@electron-toolkit/preload";

type WatchAction = "add" | "change" | "unlink" | "error" | "ready" | "raw";
type WatchCallback = (state: WatchState) => void;
type ImportCallback = (action: FileAction | string | undefined) => void;
type ScanCallback = (action: FileAction | string | undefined) => void;
type PathName = "home" | "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";

interface PhotoAction {
    action: name;
    params: Record<string, object>;
    previous: string;
}
interface Photo {
    path: string; // relative path
    history: PhotoAction[];
}

interface PhotasaConfig {
    version: string;
    photoList: Photo[];
}
interface ThumbnailRequest {
    path: string;
    thumbnail: string;
    width: number;
    height: number;
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
}
// contextBridge can only return few type, Promise is support, but rxjs is not.
declare global {
    interface Window {
        electron: ElectronAPI;
        api: {
            startWatching: (config: WatchConfig, callback: WatchCallback) => void;
            stopWatching: () => Promise<void>;
            importPhotos: (paths: string[], target: string, callback: ImportCallback) => void;
            scanPhotos: (folder: string, callback: ScanCallback) => void;
            chooseDirectory: () => Promise<DirectorySelection>;
            getDirectory: (name: PathName) => Promise<string>;
            createThumbnail: (request: ThumbnailRequest) => Promise<ThumbnailRequest>;
            removeThumbnail: (request: ThumbnailRequest) => Promise<ThumbnailRequest>;
            getImageType: (path: string) => Promise<ImageInfo>;
            openInFinder: (path: string) => void;
            getPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
            updatePhotoList: (photo: string) => Promise<PhotasaConfig>;
        };
    }
}
