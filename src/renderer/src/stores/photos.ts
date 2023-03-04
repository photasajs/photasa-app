// stores/photos.js
import { defineStore } from "pinia";

type PhotoState = {
    files: Map<string, Set<string>>;
};

export const usePhotosStore = defineStore("photos", {
    state: (): PhotoState => {
        const files = new Map();
        return {
            files,
        };
    },
    actions: {
        addFile(paths, file) {
            const path = paths.find((path) => file.startsWith(path)) ?? "";
            // Files is set. will not add duplicate file
            if (!this.files.has(path)) {
                this.files.set(path, new Set());
            }
            this.files.get(path)?.add(file);
        },
    },
});
