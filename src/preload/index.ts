import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import { ImportEvents } from "@common/constants";
import { startWatching, stopWatching } from "./fs-watch";
import { importPhotos, scanPhotos } from "./photo-import";
import { chooseDirectory, getDirectory } from "./choose-directory";
import {
    createThumbnail,
    getImageType,
    isImageFile,
    isVideoFile,
    removeThumbnail,
    fileUrlFromPath,
} from "./image-helper";
import { openInFinder } from "./shell-helper";
import {
    addToPhotoList,
    removeFromPhotoList,
    getPhotasaConfig,
    fixPhotasaConfig,
    resetPhotasaConfig,
} from "./file-config";
import { scanSubfolders, cleanupScanQueue } from "./query-config";
import { shouldIgnorePhotasaPath } from "@common/index";
import * as pathHelper from "./path-helper";
import {
    toThumbnailName,
    shortenThumbnailName,
    isFileUnderFolder,
    toFileName,
    isHiddenFile,
} from "@shared/path-util";

/**
 * 判断当前平台是否为 macOS
 * @returns {boolean} true 表示 macOS，false 表示其他平台
 */
function isMac(): boolean {
    return process.platform === "darwin";
}

// Custom APIs for renderer
const api = {
    startWatching,
    stopWatching,
    importPhotos,
    scanPhotos,
    chooseDirectory,
    getDirectory,
    createThumbnail,
    getImageType,
    removeThumbnail,
    openInFinder,
    addToPhotoList,
    removeFromPhotoList,
    getPhotasaConfig,
    scanSubfolders,
    isFileUnderFolder,
    toFileName,
    toThumbnailName,
    shortenThumbnailName,
    fixPhotasaConfig,
    resetPhotasaConfig,
    isHiddenFile,
    shouldIgnorePhotasaPath,
    isVideoFile,
    isImageFile,
    fileUrlFromPath,
    cleanupScanQueue,
    // 新增：路径相关API
    normalizePath: pathHelper.normalizePath,
    mergePath: pathHelper.mergePath,
    splitPath: pathHelper.splitPath, // 新增
    joinPath: pathHelper.joinPath, // 新增
    getSeparator: pathHelper.getSeparator, // 新增
    isMac: isMac, // 平台判断，渲染进程可直接调用
    // ========== 新增窗口控制 API ==========
    minimizeWindow: () => electronAPI.ipcRenderer.send("window:minimize"),
    maximizeWindow: () => electronAPI.ipcRenderer.send("window:maximize"),
    unmaximizeWindow: () => electronAPI.ipcRenderer.send("window:unmaximize"),
    closeWindow: () => electronAPI.ipcRenderer.send("window:close"),
    queryMaximized: () => electronAPI.ipcRenderer.send("window:queryMaximized"),
    onWindowMaximized: (cb) => electronAPI.ipcRenderer.on("window:maximized", cb),
    onWindowUnmaximized: (cb) => electronAPI.ipcRenderer.on("window:unmaximized", cb),
    onWindowMaximizedState: (cb) => electronAPI.ipcRenderer.on("window:maximizedState", cb),
    offWindowMaximized: (cb) => electronAPI.ipcRenderer.removeListener("window:maximized", cb),
    offWindowUnmaximized: (cb) => electronAPI.ipcRenderer.removeListener("window:unmaximized", cb),
    offWindowMaximizedState: (cb) =>
        electronAPI.ipcRenderer.removeListener("window:maximizedState", cb),
    /**
     * Mac 菜单同步：将 menus 数据通过 IPC 发送到主进程，由主进程设置 Electron.Menu
     * @param menus 菜单数据（已翻译 label，结构兼容 Electron.Menu）
     */
    applySystemMenu: (menus) => {
        electronAPI.ipcRenderer.send("menu:applySystemMenu", menus);
    },
    /**
     * Mac 菜单点击事件桥接：监听主进程发来的菜单点击事件，转发到 renderer
     * @param cb 回调函数，参数为菜单事件 payload
     */
    onMenuAction: (cb) => {
        electronAPI.ipcRenderer.on("menu:action", (_event, payload) => cb(payload));
    },
    openExternal: (url: string) => electronAPI.ipcRenderer.invoke("shell:openExternal", url),

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
        const handler = (_: any, progress: any) => callback(progress);
        electronAPI.ipcRenderer.on(ImportEvents.PROGRESS, handler);

        // 返回清理函数
        return () => electronAPI.ipcRenderer.removeAllListeners(ImportEvents.PROGRESS);
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
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld("electron", electronAPI);
        contextBridge.exposeInMainWorld("api", api);
    } catch (error) {
        console.error(error);
    }
} else {
    window.electron = electronAPI;
    window.api = api;
}
