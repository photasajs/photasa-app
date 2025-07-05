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
