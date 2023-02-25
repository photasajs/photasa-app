import { ElectronAPI } from "@electron-toolkit/preload";

type WatchAction = "add" | "change" | "unlink" | "error" | "ready" | "raw";
type WatchCallback = (state: WatchState) => void;

interface WatchConfig {
    paths: string[];
}

interface WatchState {
    action?: WatchAction;
    isFile?: boolean;
    path?: string;
    error?: Error;
}

declare global {
    interface Window {
        electron: ElectronAPI;
        api: {
            startWatching: (config: WatchConfig, callback: WatchCallback) => void;
        };
    }
}
