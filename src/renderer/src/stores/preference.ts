import { defineStore } from "pinia";
import { normalizePath } from "@renderer/utils/path";
import { scanPhotosTask } from "@renderer/utils/scan-folder";
import { cleanupScanQueue } from "@renderer/utils/api";
import type { PhotasaConfig } from "@common/config-types";
import type { ScanAction } from "@common/scan-types";
import type { ThumbnailRequest } from "@common/thumbnail-types";
import { DataNode } from "ant-design-vue/lib/tree";
import { buildDataNode, cleanDataNode } from "@renderer/utils/folder-tree";
import { isVideoFile, toFileName, shortenThumbnailName } from "@renderer/utils/api";
import { loggers } from "@common/logger";

const logger = loggers.app;

export type PreferenceState = {
    paths: string[]; // Paths to monitor
    thumbnailSize: number; // Thumbnail Default Size
    firstTime: boolean; // Is first time running
    darkMode: boolean;
    lastOpenedFolder: string;
    locale: string;
    scanningFolder: ScanAction[];
    currentFolder: string;
    scannedFolder: string;
    currentFolderConfig: PhotasaConfig;
    folderTree: DataNode[];
};

export type PreferenceStore = ReturnType<typeof usePreferenceStore>;

export const usePreferenceStore = defineStore("preference", {
    state: (): PreferenceState => {
        return {
            paths: [],
            thumbnailSize: 150,
            firstTime: true,
            darkMode: false,
            lastOpenedFolder: "",
            locale: "zh-CN",
            scanningFolder: [],
            currentFolder: "",
            scannedFolder: "",
            currentFolderConfig: <PhotasaConfig>{},
            folderTree: [],
        };
    },
    persist: true,
    actions: {
        addPath(path) {
            if (this.firstTime) {
                this.firstTime = false;
                this.paths = [];
                this.folderTree = [];
                this.paths.push(path);
                this.folderTree.push({
                    title: path,
                    key: path,
                    children: [],
                });
                return;
            }

            path = normalizePath(path);

            if (!this.paths.find((p) => path.indexOf(p) >= 0)) {
                this.paths.push(path);
                this.folderTree.push({
                    title: path,
                    key: path,
                    children: [],
                });
                this.paths = this.paths.sort();
            }
        },
        addScanFolder(folder: string, action: "scan" | "rescan" | "current") {
            logger.debug("Adding scan folder:", { folder, action });
            if (!Array.isArray(this.scanningFolder)) {
                logger.debug("Initializing scanningFolder array");
                this.scanningFolder = [];
            }

            // Normalize the folder path
            folder = normalizePath(folder);

            // Check if the folder is already in the scanning queue
            const existingIndex = this.scanningFolder.findIndex((p) => p.path === folder);
            if (existingIndex >= 0) {
                // If it's a rescan, update the action
                if (action === "rescan") {
                    logger.debug("Updating existing folder to rescan:", folder);
                    this.scanningFolder[existingIndex].action = "rescan";
                } else {
                    logger.debug("Folder already in scanning queue:", folder);
                }
                return;
            }

            // Add the new folder to scan
            logger.debug("Adding new folder to scan:", folder);
            this.scanningFolder.push({ path: folder, action, thumbnailSize: this.thumbnailSize });
            this.updateFolderTree(folder);
        },
        updateThumbnailSize(size: number) {
            this.thumbnailSize = size >= 150 && size <= 400 ? size : 150;
        },
        completeScanPath(folder: string): void {
            logger.debug("Completing scan for folder:", folder);
            const index = this.scanningFolder.findIndex((f) => f.path === folder);
            if (index > -1) {
                this.scanningFolder.splice(index, 1);
                logger.debug("Removed folder from scanning queue:", folder);
            }
        },
        updateFolderTree(folder: string) {
            const path = normalizePath(folder);
            buildDataNode(this.folderTree, {
                path,
                thumbnail: "",
                isVideo: false,
            });
        },
        cleanFolderTree(folder: string) {
            const path = normalizePath(folder);
            cleanDataNode(this.folderTree, {
                path,
                thumbnail: "",
                isVideo: false,
            });
        },
        removePath(path: string): void {
            logger.debug("Removing path:", path);

            // Remove from paths array
            const index = this.paths.indexOf(path);
            if (index >= 0) {
                this.paths.splice(index, 1);
                logger.debug("Removed from paths array");
            }

            // Remove from folder tree
            const found = this.folderTree.findIndex((node) => node.key === path);
            if (found >= 0) {
                this.folderTree.splice(found, 1);
                logger.debug("Removed from folder tree");
            }

            // Cancel any running scan tasks
            if (scanPhotosTask.isRunning) {
                logger.debug("Cancelling running scan tasks");
                scanPhotosTask.cancelAll();
            }

            // Clean up the scan queue
            logger.debug("Cleaning up scan queue");
            cleanupScanQueue(path);

            // Remove from scanning queue and all its subdirectories
            const originalLength = this.scanningFolder.length;
            this.scanningFolder = this.scanningFolder.filter(
                (folder) => !folder.path.startsWith(path),
            );
            logger.debug(
                `Removed ${
                    originalLength - this.scanningFolder.length
                } folders from scanning queue`,
            );

            // Complete scan for the removed path
            this.completeScanPath(path);

            // Reset current folder if it was the removed one
            if (this.currentFolder === path) {
                this.currentFolder = this.paths[0] || "";
                logger.debug("Reset current folder to:", this.currentFolder);
            }
        },
        addToCurrentPhotasaConfig(request: ThumbnailRequest): void {
            const relativePath = toFileName(request.path);
            if (this.currentFolderConfig.photoList.find((photo) => photo.path === relativePath)) {
                return;
            }
            this.currentFolderConfig.photoList.push({
                path: relativePath,
                thumbnail: shortenThumbnailName(request.thumbnail),
                isVideo: isVideoFile(request.path),
                history: [],
            });
        },
        removeFromCurrentPhotasaConfig(request: ThumbnailRequest): void {
            const relativePath = toFileName(request.path);
            const index = this.currentFolderConfig.photoList.findIndex(
                (photo) => photo.path === relativePath,
            );

            if (index >= 0) {
                this.currentFolderConfig.photoList.splice(index, 1);
            }
        },
        setLocale(locale: string) {
            this.locale = locale;
        },
        /**
         * 重置所有目录存储
         * @param newDirs 需要重建的目录数组
         * 1. 清空 paths、folderTree、scanningFolder
         * 2. 逐一 addPath 并调用 resetPhotasaConfig 重建缓存
         */
        async resetAllFolders(newDirs: string[]) {
            // 停止所有扫描任务
            if (scanPhotosTask.isRunning) {
                scanPhotosTask.cancelAll();
            }
            this.paths = [];
            this.folderTree = [];
            this.scanningFolder = [];
            for (const dir of newDirs) {
                this.addPath(dir);
                await window.api?.resetPhotasaConfig?.(dir);
            }
        },
    },
});
