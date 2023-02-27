// stores/photos.js
import { defineStore } from "pinia";

const DEFAULT_DESKTOP_PATH = "/Users/albert.li/Desktop/";

type PreferenceState = {
    paths: string[];
    thumbnailSize: number;
};

export const usePreferenceStore = defineStore("preference", {
    state: (): PreferenceState => {
        return {
            paths: [DEFAULT_DESKTOP_PATH],
            thumbnailSize: 150,
        };
    },
    persist: true,
    actions: {
        addPath(path) {
            if (this.paths.indexOf(path) < 0) {
                this.paths.push(path);
                this.paths = this.paths.sort();
            }
        },
        updateThumbnailSize(size) {
            this.thumbnailSize = size >= 150 && size <= 400 ? size : 150;
        },
    },
});
