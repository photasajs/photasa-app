/**
 * @deprecated RFC 0154：组件改用负责人物服务；本模块将在 Phase 3 删除。
 */
import type { DirectorySelection, PathName } from "@photasa/common";
import { loggers } from "@photasa/common";
import { getPhotasaApi } from "@renderer/ipc/api-access";
import { getLegacyShell } from "@/api/legacy-preload-access";
import {
    isHiddenFileSync,
    shouldIgnorePhotasaPathSync,
    shortenThumbnailNameSync,
    toFileNameSync,
    toThumbnailNameSync,
} from "@renderer/utils/sync-path";

const logger = loggers.api;
const api = () => getPhotasaApi();

export function chooseDirectory(): Promise<DirectorySelection> {
    return api().chooseDirectory();
}

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

/**
 * 选择多个目录（扩展现有的chooseDirectory功能）
 * @param multiSelect 是否允许多选
 * @returns 目录选择结果
 */
export function chooseDirectories(multiSelect = true): Promise<DirectorySelection> {
    logger.debug(`调用 chooseDirectories，multiSelect: ${multiSelect}`);
    const result = api().chooseDirectories(multiSelect);
    result
        .then((res: DirectorySelection) => logger.debug(`chooseDirectories 结果:`, res))
        .catch((err: unknown) => logger.error(`chooseDirectories 错误:`, err));
    return result;
}
