// stores/photos.js
import { defineStore } from "pinia";

export const photosStore = defineStore("photos", {
    state: () => {
        return { paths: ["/Users/albert.li/Desktop/"], files: new Set() };
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
