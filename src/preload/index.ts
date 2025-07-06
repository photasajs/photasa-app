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
