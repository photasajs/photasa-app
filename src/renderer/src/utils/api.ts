import type {
    WatchConfig,
    WatchCallback,
    ImportCallback,
    DirectorySelection,
    PathName,
    ThumbnailRequest,
    ImageInfo,
    ScanCallback,
    PhotasaConfig,
    LoadCallback,
} from "src/preload/types";
import { useTask } from "vue-concurrency";

export function startWatching(config: WatchConfig, callback: WatchCallback): void {
    window.api.startWatching(config, callback);
}

export function stopWatching(): Promise<void> {
    return window.api.stopWatching();
}

export function importPhotos(paths: string[], target: string, callback: ImportCallback): void {
    window.api.importPhotos(paths, target, callback);
}

export function chooseDirectory(): Promise<DirectorySelection> {
    return window.api.chooseDirectory();
}

export interface MenuCallback {
    onPreference: () => void;
    onImportPhotos: () => void;
}

export function setupMenu(callback: MenuCallback): void {
    window.electron.ipcRenderer.on("picasa:open-preference", callback.onPreference);
    window.electron.ipcRenderer.on("picasa:import-photos", callback.onImportPhotos);
}

export function getDirectory(name: PathName): Promise<string> {
    return window.api.getDirectory(name);
}

export const createThumbnailTask = useTask(function* (_, request: ThumbnailRequest) {
    const result = yield window.api.createThumbnail(request);
    return result;
})
    .enqueue()
    .maxConcurrency(3);

export const removeThumbnailTask = useTask(function* (_, request: ThumbnailRequest) {
    const result = yield window.api.removeThumbnail(request);
    return result;
})
    .enqueue()
    .maxConcurrency(1);

export function getImageType(path: string): Promise<ImageInfo> {
    return window.api.getImageType(path);
}

export function openInFinder(path: string): void {
    window.api.openInFinder(path);
}

export function scanPhotos(folder: string, callback: ScanCallback): void {
    window.api.scanPhotos(folder, callback);
}

export async function addToPhotoList(photoPath: string): Promise<{path: string, config: PhotasaConfig}> {
    return window.api.addToPhotoList(photoPath);
}

export async function removeFromPhotoList(photoPath: string): Promise<{path: string, config: PhotasaConfig}> {
    return window.api.removeFromPhotoList(photoPath);
}

export async function getPhotasaConfig(folder: string): Promise<PhotasaConfig> {
    return window.api.getPhotasaConfig(folder);
}

export const getPhotasaConfigTask = useTask(function* (_, folder: string) {
    const result = yield getPhotasaConfig(folder);
    return result;
})
    .enqueue()
    .maxConcurrency(1);

export function loadPhotasaConfigs(paths: string[], callback: LoadCallback): void {
    window.api.loadPhotasaConfigs(paths, callback);
}

export function scanSubfolders(folder): Promise<string[]> {
    return window.api.scanSubfolders(folder);
}

export function isFileUnderFolder(file: string, folder: string): boolean {
    return window.api.isFileUnderFolder(file, folder);
}

