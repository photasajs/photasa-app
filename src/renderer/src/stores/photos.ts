// stores/photos.js
import { defineStore } from "pinia";
import type { Photo } from "@renderer/utils/folder-tree";

type PhotoState = {
    files: Map<string, Set<Photo>>;
    currentFolder: string;
    processingFile: string;
};

export const usePhotosStore = defineStore("photos", {
    state: (): PhotoState => {
        const files = new Map();
        return {
            files,
            currentFolder: "",
            processingFile: "",
        };
    },
    actions: {
        addFile(paths: string[], file: Photo): void {
            const path = paths.find((path) => file.path.startsWith(path)) ?? "";
            // Files is set. will not add duplicate file
            if (!this.files.has(path)) {
                this.files.set(path, new Set());
            }
            this.files.get(path)?.add(file);
        },
        setCurrentFolder(folder: string): void {
            if (folder.length > 0) {
                this.currentFolder = folder;
            }
        },
    },
});
