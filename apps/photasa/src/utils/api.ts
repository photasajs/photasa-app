import type { ImportCallback } from "@photasa/common";
import type { DirectorySelection, PathName } from "@photasa/common";
import { useTask } from "vue-concurrency";
import type { WatchConfig, WatchCallback } from "@photasa/common";
import type { ThumbnailRequest } from "@photasa/common";
import type { ImageInfo } from "@photasa/common";
import type { ScanAction, ScanArgs } from "@photasa/common";
import type { PhotasaConfig } from "@photasa/common";
import type {
    ImportConfig,
    ImportPreview,
    ImportResult,
    ImportResumeResult,
    ImportProgress,
    ImportHistory,
    UndoResult,
    FileGroup,
    EnhancedImportCallback,
    ImportFilters,
    FileMetadata,
} from "@photasa/common";
import { loggers } from "@photasa/common";

const logger = loggers.api;

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

export function getFileMetadata(pathOrUrl: string): Promise<FileMetadata> {
    return window.api.getFileMetadata(pathOrUrl);
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

export function scanSubfolders(folder: string): Promise<string[]> {
    return window.api.scanSubfolders(folder);
}

export function checkPhotasaConfig(
    folderPath: string,
): Promise<{ hasConfig: boolean; photoCount?: number; reason: string }> {
    return window.api.checkPhotasaConfig(folderPath);
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

// ==================== 增强的导入功能 API ====================

/**
 * 扫描多个源目录，获取文件组信息
 * @param paths 源目录路径数组
 * @param filters 可选的过滤条件
 * @returns 文件组数组
 */
export function scanDirectories(paths: string[], filters?: ImportFilters): Promise<FileGroup[]> {
    return window.api.scanDirectories(paths, filters);
}

/**
 * 预览导入操作，不实际执行导入
 * @param config 导入配置
 * @returns 导入预览信息
 */
export function previewImport(config: ImportConfig): Promise<ImportPreview> {
    return window.api.previewImport(config);
}

/**
 * 执行导入操作
 * @param config 导入配置
 * @returns 导入ID
 */
export function executeImport(config: ImportConfig): Promise<{ importId: string }> {
    return window.api.executeImport(config);
}

/**
 * 监听导入进度事件
 * @param callback 进度回调函数
 * @returns 清理函数
 */
export function onImportProgress(callback: (progress: ImportProgress) => void): () => void {
    return window.api.onImportProgress(callback);
}

/**
 * 监听预览进度事件
 * @param callback 预览进度回调函数
 * @returns 清理函数
 */
export function onPreviewProgress(callback: (progress: any, files?: any[]) => void): () => void {
    return window.api.onPreviewProgress(callback);
}

/**
 * 监听导入完成事件
 * @param callback 完成回调函数
 * @returns 清理函数
 */
export function onImportComplete(callback: (result: ImportResult) => void): () => void {
    return window.api.onImportComplete(callback);
}

/**
 * 监听导入错误事件
 * @param callback 错误回调函数
 * @returns 清理函数
 */
export function onImportError(callback: (error: any) => void): () => void {
    return window.api.onImportError(callback);
}

/**
 * 移除所有导入相关的事件监听器
 */
export function removeImportListeners(): void {
    return window.api.removeImportListeners();
}

/**
 * 取消正在进行的导入操作
 * @param importId 导入任务ID
 * @returns 取消结果
 */
export function cancelImport(importId: string): Promise<boolean> {
    return window.api.cancelImport(importId);
}

/**
 * 暂停正在进行的导入操作
 * @param importId 导入任务ID
 * @returns 暂停结果
 */
export function pauseImport(importId: string): Promise<boolean> {
    return window.api.pauseImport(importId);
}

/**
 * 恢复暂停的导入操作
 * @param importId 导入任务ID
 * @returns 恢复结果
 */
export function resumeImport(importId: string): Promise<ImportResumeResult> {
    return window.api.resumeImport(importId);
}

/**
 * 获取导入历史记录
 * @param limit 可选的记录数量限制
 * @returns 导入历史数组
 */
export function getImportHistory(limit?: number): Promise<ImportHistory[]> {
    return window.api.getImportHistory(limit);
}

/**
 * 获取导入详情
 * @param historyId 历史记录ID
 * @returns 导入详情
 */
export function getImportDetails(historyId: string): Promise<ImportHistory | null> {
    return window.api.getImportDetails(historyId);
}

/**
 * 预览撤销操作
 * @param historyId 历史记录ID
 * @returns 撤销预览信息
 */
export function previewUndo(historyId: string): Promise<any> {
    return window.api.previewUndo(historyId);
}

/**
 * 撤销指定的导入操作
 * @param historyId 历史记录ID
 * @returns 撤销结果
 */
export function undoImport(historyId: string): Promise<UndoResult> {
    return window.api.undoImport(historyId);
}

/**
 * 获取导入进度信息
 * @param importId 导入任务ID
 * @returns 进度信息
 */
export function getImportProgress(importId: string): Promise<ImportProgress> {
    return window.api.getImportProgress(importId);
}

/**
 * 选择多个目录（扩展现有的chooseDirectory功能）
 * @param multiSelect 是否允许多选
 * @returns 目录选择结果
 */
export function chooseDirectories(multiSelect = true): Promise<DirectorySelection> {
    logger.debug(`调用 chooseDirectories，multiSelect: ${multiSelect}`);
    const result = window.api.chooseDirectories(multiSelect);
    result
        .then((res: DirectorySelection) => logger.debug(`chooseDirectories 结果:`, res))
        .catch((err: unknown) => logger.error(`chooseDirectories 错误:`, err));
    return result;
}

// ==================== 使用 vue-concurrency 的任务包装器 ====================

/**
 * 扫描目录任务（支持并发控制）
 */
export const scanDirectoriesTask = useTask(function* (_, paths: string[], filters?: ImportFilters) {
    const result = yield scanDirectories(paths, filters);
    return result;
})
    .enqueue()
    .maxConcurrency(2);

/**
 * 预览导入任务（支持并发控制）
 */
export const previewImportTask = useTask(function* (_, config: ImportConfig) {
    const result = yield previewImport(config);
    return result;
})
    .enqueue()
    .maxConcurrency(1);

/**
 * 执行导入任务（支持并发控制）
 */
export const executeImportTask = useTask(function* (_, config: ImportConfig) {
    const result = yield executeImport(config);
    return result;
})
    .enqueue()
    .maxConcurrency(1); // 同时只允许一个导入任务

/**
 * 获取导入历史任务（支持并发控制）
 */
export const getImportHistoryTask = useTask(function* (_, limit?: number) {
    const result = yield getImportHistory(limit);
    return result;
})
    .enqueue()
    .maxConcurrency(1);

// ==================== 兼容性保持 ====================

/**
 * 扩展现有的importPhotos函数，保持向后兼容
 * 同时支持新的增强回调
 */
export function importPhotosEnhanced(
    paths: string[],
    target: string,
    callback: ImportCallback | EnhancedImportCallback,
): void {
    // 检查是否为增强回调
    if (
        "onProgress" in callback ||
        "onDuplicateFound" in callback ||
        "onFileGroupDetected" in callback
    ) {
        // 使用新的增强导入功能
        const config: ImportConfig = {
            sourcePaths: paths,
            targetPath: target,
            filters: {
                fileTypes: ["all"],
                sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                dateRange: { start: new Date(0), end: new Date() },
                includeSubfolders: true,
            },
            duplicateStrategy: "rename",
            fileGroups: [],
            selectedFiles: [],
            allowDuplicateRename: true,
        };

        executeImport(config);
    } else {
        // 使用原有的导入功能
        importPhotos(paths, target, callback as ImportCallback);
    }
}
