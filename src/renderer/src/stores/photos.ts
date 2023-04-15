// stores/photos.js
import { defineStore } from "pinia";
import type { Photo } from "@renderer/utils/folder-tree";

type PhotoState = {
    files: Map<string, Map<string, Photo>>; // Photasa Config file list
    currentFolder: string;
    processingFile: string;
    folderFiles: Record<string, Set<Photo>>;
};

export const usePhotosStore = defineStore("photos", {
    state: (): PhotoState => {
        const files = new Map();
        return {
            files,
            currentFolder: "",
            processingFile: "",
            folderFiles: {},
        };
    },
    actions: {
        setCurrentFolder(folder: string): void {
            if (folder?.length > 0) {
                this.currentFolder = folder;
            }
        },
    },
});
