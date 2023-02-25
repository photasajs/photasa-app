// stores/photos.js
import { defineStore } from "pinia";

const DEFAULT_DESKTOP_PATH = "/Users/albert.li/Desktop/";

export const photosStore = defineStore("photos", {
    state: () => {
        return { paths: [DEFAULT_DESKTOP_PATH], files: new Set() };
    },
    persist: true,
    actions: {
        addPtah(path) {
            if (this.paths.indexOf(path) < 0) {
                this.paths.push(path);
                this.paths = this.paths.sort();
            }
        },
        addFile(file) {
            // Files is set. will not add duplicate file
            this.files.add(file);
        },
    },
});
