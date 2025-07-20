import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
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
        electronAPI.ipcRenderer.invoke("import:scan-directories", paths, filters),

    /**
     * 预览导入操作，不实际执行导入
     */
    previewImport: (config: any) => electronAPI.ipcRenderer.invoke("import:preview", config),

    /**
     * 执行导入操作
     */
    executeImport: (config: any, callback?: any) =>
        electronAPI.ipcRenderer.invoke("import:execute", config, callback),

    /**
     * 取消正在进行的导入操作
     */
    cancelImport: (importId: string) => electronAPI.ipcRenderer.invoke("import:cancel", importId),

    /**
     * 暂停正在进行的导入操作
     */
    pauseImport: (importId: string) => electronAPI.ipcRenderer.invoke("import:pause", importId),

    /**
     * 恢复暂停的导入操作
     */
    resumeImport: (importId: string) => electronAPI.ipcRenderer.invoke("import:resume", importId),

    /**
     * 获取导入历史记录
     */
    getImportHistory: (limit?: number) =>
        electronAPI.ipcRenderer.invoke("import:get-history", limit),

    /**
     * 获取导入详情
     */
    getImportDetails: (historyId: string) =>
        electronAPI.ipcRenderer.invoke("import:get-details", historyId),

    /**
     * 预览撤销操作
     */
    previewUndo: (historyId: string) =>
        electronAPI.ipcRenderer.invoke("import:preview-undo", historyId),

    /**
     * 撤销指定的导入操作
     */
    undoImport: (historyId: string) => electronAPI.ipcRenderer.invoke("import:undo", historyId),

    /**
     * 获取导入进度信息
     */
    getImportProgress: (importId: string) =>
        electronAPI.ipcRenderer.invoke("import:get-progress", importId),

    /**
     * 选择多个目录（扩展现有的chooseDirectory功能）
     */
    chooseDirectories: (multiSelect = true) =>
        electronAPI.ipcRenderer.invoke("import:choose-directories", multiSelect),

    /**
     * 提取文件元数据
     */
    extractMetadata: (request: any) =>
        electronAPI.ipcRenderer.invoke("import:extract-metadata", request),
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
