// stores/photos.js
import { defineStore } from "pinia";

const DEFAULT_DESKTOP_PATH = "/Users/albert.li/Desktop/";

export type PhotoState = {
    paths: string[];
    files: Map<string, Set<string>>;
};

export const usePhotosStore = defineStore("photos", {
    state: () => {
        const paths = [DEFAULT_DESKTOP_PATH];
        const files = new Map();
        paths.forEach((path) => {
            files.set(path, new Set());
        });
        return {
            paths,
            files,
        };
    },
    persist: true,
    actions: {
        addPtah(path) {
            if (this.paths.indexOf(path) < 0) {
                this.paths.push(path);
                this.paths = this.paths.sort();
                this.files.set(path, new Set());
            }
        },
        addFile(file) {
            const path = this.paths.find((path) => file.startsWith(path)) ?? "";
            // Files is set. will not add duplicate file
            if (!this.files?.has?.call(this.files, path)) {
                this.files.set(path, new Set());
            }
            this.files.get(path)?.add(file);
        },
    },
});
