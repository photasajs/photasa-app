import { ElectronAPI } from "@electron-toolkit/preload";

type WatchAction = "add" | "change" | "unlink" | "error" | "ready" | "raw";
type WatchCallback = (state: WatchState) => void;
type ImportCallback = (action: FileAction | string | undefined) => void;
type PathName = "home" | "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";

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
            chooseDirectory: () => Promise<DirectorySelection>;
            getDirectory: (name: PathName) => Promise<string>;
            createThumbnail: (request: ThumbnailRequest) => Promise<ThumbnailRequest>;
            getImageType: (path: string) => Promise<ImageInfo>;
        };
    }
}
