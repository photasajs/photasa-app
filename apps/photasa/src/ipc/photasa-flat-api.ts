/**
 * Typed surface for `window.api` / `getPhotasaApi()` until RFC 0097 retires legacy-api.ts.
 */
import type {
    DirectorySelection,
    PathName,
    ScanAction,
    ScanArgs,
    WatchCallback,
    WatchConfig,
} from "@photasa/common";

type Unsubscribe = () => void;

export interface PhotasaFlatApi {
    startWatching: (config: WatchConfig, callback: WatchCallback) => void;
    stopWatching: () => Promise<void>;
    chooseDirectory: () => Promise<DirectorySelection>;
    chooseDirectories: (multiSelect?: boolean) => Promise<DirectorySelection>;
    getDirectory: (name: PathName) => Promise<string | null>;
    scanPhotos: (scan: ScanAction) => Promise<ScanArgs>;
    scanSubfolders: (folder: string) => Promise<string[]>;
    isFileUnderFolder: (file: string, folder: string) => boolean | Promise<boolean>;
    isVideoFile: (fileName: string) => boolean | Promise<boolean>;
    isImageFile: (fileName: string) => boolean | Promise<boolean>;
    relativePath: (from: string, to: string) => Promise<string> | string;
    resolvePath: (...segments: string[]) => Promise<string> | string;
    getRoot: (path: string) => Promise<string> | string;
    onUpdateAvailable?: (cb: (data: { version: string; info?: unknown }) => void) => Unsubscribe;
    onUpdateProgress?: (cb: (progress: number) => void) => Unsubscribe;
    onUpdateDownloaded?: (cb: (info?: unknown) => void) => Unsubscribe;
    onStatusChanged?: (cb: (status: unknown) => void) => Unsubscribe;
}
