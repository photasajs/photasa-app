/**
 * @deprecated RFC 0154：组件改用负责人物服务；本模块将在 Phase 3 删除。
 */
import type { PathName } from "@photasa/common";
import { getPhotasaApi } from "@renderer/ipc/api-access";
import { getLegacyShell } from "@/api/legacy-preload-access";
import {
    isHiddenFileSync,
    shouldIgnorePhotasaPathSync,
    shortenThumbnailNameSync,
    toFileNameSync,
    toThumbnailNameSync,
} from "@renderer/utils/sync-path";

const api = () => getPhotasaApi();

export interface MenuCallback {
    onPreference: () => void;
    onImportPhotos: () => void;
}

export function setupMenu(callback: MenuCallback): void {
    const ipc = getLegacyShell()?.ipcRenderer;
    ipc?.on("picasa:open-preference", callback.onPreference);
    ipc?.on("picasa:import-photos", callback.onImportPhotos);
}

export function getDirectory(name: PathName): Promise<string | null> {
    return api().getDirectory(name);
}

export function scanSubfolders(folder: string): Promise<string[]> {
    return api().scanSubfolders(folder);
}

export function isFileUnderFolder(file: string, folder: string): boolean | Promise<boolean> {
    return api().isFileUnderFolder(file, folder);
}

export function isHiddenFile(fileName: string): boolean {
    return isHiddenFileSync(fileName);
}

export function shouldIgnorePhotasaPath(fileName: string): boolean {
    return shouldIgnorePhotasaPathSync(fileName);
}

export function isVideoFile(fileName: string): boolean | Promise<boolean> {
    return api().isVideoFile(fileName);
}

export function isImageFile(fileName: string): boolean | Promise<boolean> {
    return api().isImageFile(fileName);
}

export function toFileName(fileName: string): string {
    return toFileNameSync(fileName);
}

export function toThumbnailName(fileName: string): string {
    return toThumbnailNameSync(fileName);
}

export function shortenThumbnailName(fileName: string): string {
    return shortenThumbnailNameSync(fileName);
}
