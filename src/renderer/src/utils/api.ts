import type {
    WatchConfig,
    WatchCallback,
    ImportCallback,
    DirectorySelection,
} from "src/preload/index.d";

export function startWatching(config: WatchConfig, callback: WatchCallback): void {
    window.api.startWatching(config, callback);
}

export function importPhotos(paths: string[], target: string, callback: ImportCallback): void {
    window.api.importPhotos(paths, target, callback);
}

export function chooseDirectory(): Promise<DirectorySelection> {
    return window.api.chooseDirectory();
}
