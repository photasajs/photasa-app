import { electronAPI } from "@electron-toolkit/preload";
import { ImportEvents } from "@photasa/common";
import type { FileOperation } from "@photasa/common";
import { startWatching, stopWatching } from "./fs-watch";
import { importPhotos, scanPhotos } from "./photo-import";
import { chooseDirectory, getDirectory } from "./choose-directory";
import {
    createThumbnail,
    getImageType,
    getFileMetadata,
    isImageFile,
    isVideoFile,
    removeThumbnail,
    fileUrlFromPath,
} from "./image-helper";
import { normalizePath } from "@shared/path-util";
// ✅ RFC 0058: openInFinder 已迁移到服务架构，不再通过 preload API
import type { LogEntry } from "@photasa/common";
import { updateApi } from "./update-helper";
import {
    addToPhotoList,
    removeFromPhotoList,
    getPhotasaConfig,
    fixPhotasaConfig,
    resetPhotasaConfig,
} from "./file-config";
import { scanSubfolders, cleanupScanQueue, checkPhotasaConfig } from "./query-config";
import { shouldIgnorePhotasaPath } from "@photasa/common";
import * as pathHelper from "./path-helper";
import {
    toThumbnailName,
    shortenThumbnailName,
    isFileUnderFolder,
    toFileName,
    isHiddenFile,
    toDirName,
} from "@shared/path-util";

/**
 * 判断当前平台是否为 macOS
 * @returns {boolean} true 表示 macOS，false 表示其他平台
 */
function isMac(): boolean {
    return process.platform === "darwin";
}

// Custom APIs for renderer
export const api = {
    startWatching,
    stopWatching,
    importPhotos,
    scanPhotos,
    chooseDirectory,
    getDirectory,
    createThumbnail,
    getImageType,
    getFileMetadata,
    removeThumbnail,
    // ✅ RFC 0058: openInFinder 已迁移到服务架构，使用 useZhangSunWuJi().openInFinder()
    addToPhotoList,
    removeFromPhotoList,
    getPhotasaConfig,
    scanSubfolders,
    checkPhotasaConfig,
    isFileUnderFolder,
    toFileName,
    toThumbnailName,
    shortenThumbnailName,
    fixPhotasaConfig,
    resetPhotasaConfig,
    isHiddenFile,
    shouldIgnorePhotasaPath,
    toDirName,
    isVideoFile,
    isImageFile,
    fileUrlFromPath,
    cleanupScanQueue,
    // 新增：路径相关API
    mergePath: pathHelper.mergePath,
    splitPath: pathHelper.splitPath, // 新增
    joinPath: pathHelper.joinPath, // 新增
    getSeparator: pathHelper.getSeparator, // 新增
    // 统一的路径规范化API（从shared层导入）
    normalizePath,
    isMac: isMac, // 平台判断，渲染进程可直接调用
    // ========== 新增窗口控制 API ==========
    minimizeWindow: () => electronAPI.ipcRenderer.send("window:minimize"),
    maximizeWindow: () => electronAPI.ipcRenderer.send("window:maximize"),
    unmaximizeWindow: () => electronAPI.ipcRenderer.send("window:unmaximize"),
    closeWindow: () => electronAPI.ipcRenderer.send("window:close"),
    queryMaximized: () => electronAPI.ipcRenderer.send("window:queryMaximized"),
    onWindowMaximized: (cb: (...args: any[]) => void) =>
        electronAPI.ipcRenderer.on("window:maximized", cb),
    onWindowUnmaximized: (cb: (...args: any[]) => void) =>
        electronAPI.ipcRenderer.on("window:unmaximized", cb),
    onWindowMaximizedState: (cb: (...args: any[]) => void) =>
        electronAPI.ipcRenderer.on("window:maximizedState", cb),
    offWindowMaximized: (cb: (...args: any[]) => void) =>
        electronAPI.ipcRenderer.removeListener("window:maximized", cb),
    offWindowUnmaximized: (cb: (...args: any[]) => void) =>
        electronAPI.ipcRenderer.removeListener("window:unmaximized", cb),
    offWindowMaximizedState: (cb: (...args: any[]) => void) =>
        electronAPI.ipcRenderer.removeListener("window:maximizedState", cb),
    /**
     * Mac 菜单同步：将 menus 数据通过 IPC 发送到主进程，由主进程设置 Electron.Menu
     * @param menus 菜单数据（已翻译 label，结构兼容 Electron.Menu）
     */
    applySystemMenu: (menus: any) => {
        electronAPI.ipcRenderer.send("menu:applySystemMenu", menus);
    },
    /**
     * Mac 菜单点击事件桥接：监听主进程发来的菜单点击事件，转发到 renderer
     * @param cb 回调函数，参数为菜单事件 payload
     */
    onMenuAction: (cb: (payload: any) => void) => {
        electronAPI.ipcRenderer.on("menu:action", (_event, payload) => cb(payload));
    },
    // ✅ RFC 0058: openExternal 已迁移到服务架构，使用 useZhangSunWuJi().openExternal()

    // ==================== 自动更新功能 API ====================
    ...updateApi,

    // ==================== 增强的导入功能 API ====================
    /**
     * 扫描多个源目录，获取文件组信息
     */
    scanDirectories: (paths: string[], filters?: any) =>
        electronAPI.ipcRenderer.invoke(ImportEvents.SCAN_DIRECTORIES, paths, filters),

    /**
     * 预览导入操作，不实际执行导入
     */
    previewImport: (config: any) => electronAPI.ipcRenderer.invoke(ImportEvents.PREVIEW, config),

    /**
     * 执行导入操作（纯事件驱动模式）
     */
    executeImport: (config: any): Promise<{ importId: string }> => {
        return electronAPI.ipcRenderer.invoke(ImportEvents.EXECUTE, config);
    },

    /**
     * 监听导入进度事件
     */
    onImportProgress: (callback: (progress: any) => void) => {
        const handler = (_: any, eventData: any) => {
            // 从事件数据中提取进度对象
            const progress = eventData.progress || eventData;
            callback(progress);
        };
        electronAPI.ipcRenderer.on(ImportEvents.PROGRESS, handler);

        // 返回清理函数
        return () => electronAPI.ipcRenderer.removeAllListeners(ImportEvents.PROGRESS);
    },

    /**
     * 监听预览进度事件
     */
    onPreviewProgress: (callback: (progress: any, files?: any[]) => void) => {
        const handler = (_: any, eventData: any) => {
            // 处理从import-service发送的数据结构
            const { progress, files } = eventData;
            callback(progress, files);
        };
        electronAPI.ipcRenderer.on("preview:progress", handler);

        // 返回清理函数
        return () => electronAPI.ipcRenderer.removeAllListeners("preview:progress");
    },

    /**
     * 监听导入完成事件
     */
    onImportComplete: (callback: (result: any) => void) => {
        const handler = (_: any, result: any) => callback(result);
        electronAPI.ipcRenderer.on(ImportEvents.COMPLETE, handler);

        return () => electronAPI.ipcRenderer.removeAllListeners(ImportEvents.COMPLETE);
    },

    /**
     * 监听导入错误事件
     */
    onImportError: (callback: (error: any) => void) => {
        const handler = (_: any, error: any) => callback(error);
        electronAPI.ipcRenderer.on(ImportEvents.ERROR, handler);

        return () => electronAPI.ipcRenderer.removeAllListeners(ImportEvents.ERROR);
    },

    /**
     * 移除所有导入相关的事件监听器
     */
    removeImportListeners: () => {
        electronAPI.ipcRenderer.removeAllListeners(ImportEvents.PROGRESS);
        electronAPI.ipcRenderer.removeAllListeners(ImportEvents.COMPLETE);
        electronAPI.ipcRenderer.removeAllListeners(ImportEvents.ERROR);
    },

    /**
     * 取消正在进行的导入操作
     */
    cancelImport: (importId: string) =>
        electronAPI.ipcRenderer.invoke(ImportEvents.CANCEL, importId),

    /**
     * 暂停正在进行的导入操作
     */
    pauseImport: (importId: string) => electronAPI.ipcRenderer.invoke(ImportEvents.PAUSE, importId),

    /**
     * 恢复暂停的导入操作
     */
    resumeImport: (importId: string) =>
        electronAPI.ipcRenderer.invoke(ImportEvents.RESUME, importId),

    /**
     * 获取导入历史记录
     */
    getImportHistory: (limit?: number) =>
        electronAPI.ipcRenderer.invoke(ImportEvents.GET_HISTORY, limit),

    /**
     * 获取导入详情
     */
    getImportDetails: (historyId: string) =>
        electronAPI.ipcRenderer.invoke(ImportEvents.GET_DETAILS, historyId),

    /**
     * 预览撤销操作
     */
    previewUndo: (historyId: string) =>
        electronAPI.ipcRenderer.invoke(ImportEvents.PREVIEW_UNDO, historyId),

    /**
     * 撤销指定的导入操作
     */
    undoImport: (historyId: string) => electronAPI.ipcRenderer.invoke(ImportEvents.UNDO, historyId),

    /**
     * 获取导入进度信息
     */
    getImportProgress: (importId: string) =>
        electronAPI.ipcRenderer.invoke(ImportEvents.GET_PROGRESS, importId),

    /**
     * 选择多个目录（扩展现有的chooseDirectory功能）
     */
    chooseDirectories: (multiSelect = true) =>
        electronAPI.ipcRenderer.invoke(ImportEvents.CHOOSE_DIRECTORIES, multiSelect),

    /**
     * 提取文件元数据
     */
    extractMetadata: (request: any) =>
        electronAPI.ipcRenderer.invoke(ImportEvents.EXTRACT_METADATA, request),

    /**
     * 监听文件监视服务发送的批量操作事件
     */
    onScanQueueAdd: (callback: (operations: FileOperation[]) => void) => {
        const handler = (_: unknown, operations: FileOperation[]) => callback(operations);
        electronAPI.ipcRenderer.on("picasa:add-to-scan-queue", handler);

        return () => electronAPI.ipcRenderer.removeListener("picasa:add-to-scan-queue", handler);
    },
    // ========== 日志查看器 API ==========
    log: {
        viewerOpen: () => electronAPI.ipcRenderer.invoke("log:viewer-open"),
        viewerClose: () => electronAPI.ipcRenderer.invoke("log:viewer-close"),
        onEntry: (callback: (entry: LogEntry) => void) => {
            electronAPI.ipcRenderer.on("log:entry", (_, entry) => callback(entry));
        },
        onToggleViewer: (callback: () => void) => {
            electronAPI.ipcRenderer.on("log:toggle-viewer", callback);
        },
    },
};
