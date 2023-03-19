// stores/photos.js
import { defineStore } from "pinia";
import { normalizePath } from "@renderer/utils/path";

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

                // Add to scanning queue, if app is quit, next time start will rescan it.
                this.scanningFolder.push(path);
            }
        },
        updateThumbnailSize(size) {
            this.thumbnailSize = size >= 150 && size <= 400 ? size : 150;
        },
        removePath(path: string): void {
            const index = this.paths.indexOf(path);
            if (index >= 0) {
                this.paths.splice(index, 1);
            }
        },
    },
});
