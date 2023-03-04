// stores/photos.js
import { defineStore } from "pinia";

type PreferenceState = {
    paths: string[];
    thumbnailSize: number;
    firstTime: boolean;
};

export const usePreferenceStore = defineStore("preference", {
    state: (): PreferenceState => {
        return {
            paths: [],
            thumbnailSize: 150,
            firstTime: true,
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

            if (!this.paths.find((p) => path.indexOf(p) >= 0)) {
                this.paths.push(path);
                this.paths = this.paths.sort();
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
