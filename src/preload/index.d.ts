import { ElectronAPI } from "@electron-toolkit/preload";
import type { DirectorySelection } from "./choose-directory";

type WatchAction = "add" | "change" | "unlink" | "error" | "ready" | "raw";
type WatchCallback = (state: WatchState) => void;
type ImportCallback = (action: FileAction | string | undefined) => void;

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
}
// contextBridge can only return few type, Promise is support, but rxjs is not.
declare global {
    interface Window {
        electron: ElectronAPI;
        api: {
            startWatching: (config: WatchConfig, callback: WatchCallback) => void;
            importPhotos: (paths: string[], target: string, callback: ImportCallback) => void;
            chooseDirectory: () => Promise<DirectorySelection>;
        };
    }
}
