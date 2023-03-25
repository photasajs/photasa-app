// stores/photos.js
import { defineStore } from "pinia";
import { normalizePath } from "@renderer/utils/path";
import { scanPhotosTask } from "@renderer/utils/scan-folder";

type PreferenceState = {
    paths: string[];
    thumbnailSize: number;
    firstTime: boolean;
    darkMode: boolean;
    lastOpenedFolder: string;
    locale: string;
    scanningFolder: string[];
    currentFolder: string;
};

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
        };
    },
    persist: true,
    actions: {
        addPath(path) {
            if (this.firstTime) {
                this.firstTime = false;
                this.paths = [];
                this.paths.push(path);
                return;
            }

            path = normalizePath(path);

            if (!this.paths.find((p) => path.indexOf(p) >= 0)) {
                this.paths.push(path);
                this.paths = this.paths.sort();
            }
        },
        addScanFolder(folder: string) {
            if (!this.scanningFolder.find((p) => p === folder)) {
                this.scanningFolder.push(folder);
            }
        },
        updateThumbnailSize(size: number) {
            this.thumbnailSize = size >= 150 && size <= 400 ? size : 150;
        },
        completeScanPath(folder: string): void {
            const index = this.scanningFolder.findIndex((f) => f === folder);
            if (index > -1) {
                this.scanningFolder.splice(index, 1);
            }
        },
        removePath(path: string): void {
            const index = this.paths.indexOf(path);
            if (index >= 0) {
                this.paths.splice(index, 1);
            }

            if (scanPhotosTask.isRunning) {
                scanPhotosTask.cancelAll();
            }

            this.completeScanPath(path);
        },
    },
});
