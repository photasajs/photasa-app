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
import {
    isFileUnderFolder,
    isHiddenFile,
    shouldIgnorePhotasaPath,
    toFileName,
    toThumbnailName,
    shortenThumbnailName,
} from "../common";
import * as pathHelper from "./path-helper";

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
