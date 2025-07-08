import type { ImportCallback } from "@common/types";
import type { DirectorySelection, PathName } from "@common/types";
import { useTask } from "vue-concurrency";
import type { WatchConfig, WatchCallback } from "@common/watch-types";
import type { ThumbnailRequest } from "@common/thumbnail-types";
import type { ImageInfo } from "@common/types";
import type { ScanAction, ScanArgs } from "@common/scan-types";
import type { PhotasaConfig } from "@common/config-types";

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

export function normalizeThumbnailRequest(request: ThumbnailRequest): ThumbnailRequest {
    function fixPath(p: string): string {
        let s = p.replace(/^file:\/\/+/, "");
        if (s && s[0] !== "/") s = "/" + s;
        return s;
    }
    return {
        ...request,
        path: fixPath(request.path),
        thumbnail: fixPath(request.thumbnail),
    };
}

export const createThumbnailTask = useTask(function* (_, request: ThumbnailRequest) {
    const normalizedRequest = normalizeThumbnailRequest(request);
    const result = yield window.api.createThumbnail(normalizedRequest);
    return result;
})
    .enqueue()
    .maxConcurrency(2);

export const removeThumbnailTask = useTask(function* (_, request: ThumbnailRequest) {
    const result = yield window.api.removeThumbnail(request);
    return result;
})
    .enqueue()
    .maxConcurrency(1);

export function getImageType(path: string): Promise<ImageInfo> {
    return window.api.getImageType(path);
}

export function scanPhotos(folder: ScanAction): Promise<ScanArgs> {
    return window.api.scanPhotos(folder);
}

export async function addToPhotoList(
    photoPath: string,
): Promise<{ path: string; config: PhotasaConfig }> {
    return window.api.addToPhotoList(photoPath);
}

export async function removeFromPhotoList(
    photoPath: string,
): Promise<{ path: string; config: PhotasaConfig }> {
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

export const cleanupScanQueue = (folderPath: string): void => {
    window.api.cleanupScanQueue(folderPath);
};

export function scanSubfolders(folder): Promise<string[]> {
    return window.api.scanSubfolders(folder);
}

export function isFileUnderFolder(file: string, folder: string): boolean {
    return window.api.isFileUnderFolder(file, folder);
}

export function resetPhotasaConfig(folder: string): Promise<PhotasaConfig> {
    return window.api.resetPhotasaConfig(folder);
}

export function fixPhotasaConfig(folder: string): Promise<PhotasaConfig> {
    return window.api.fixPhotasaConfig(folder);
}

export function isHiddenFile(fileName: string): boolean {
    return window.api.isHiddenFile(fileName);
}

export function shouldIgnorePhotasaPath(fileName: string): boolean {
    return window.api.shouldIgnorePhotasaPath(fileName);
}

export function isVideoFile(fileName: string): boolean {
    return window.api.isVideoFile(fileName);
}

export function isImageFile(fileName: string): boolean {
    return window.api.isImageFile(fileName);
}

export function toFileName(fileName: string): string {
    return window.api.toFileName(fileName);
}

export function toThumbnailName(fileName: string): string {
    return window.api.toThumbnailName(fileName);
}

export function shortenThumbnailName(fileName: string): string {
    return window.api.shortenThumbnailName(fileName);
}
