// stores/photos.js
import { defineStore } from "pinia";
import type { Photo } from "@renderer/utils/folder-tree";
import { mergePath } from "@renderer/utils/path";

type PhotoState = {
    files: Map<string, Map<string, Photo>>;
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
        /**
         * Add photasa config file to store, which will be used to build folder tree node
         * @param paths All watched paths
         * @param file File to add
         */
        addFile(paths: string[], file: Photo): void {
            // Find root folder which is watched.
            const path = paths.find((path) => file.path.startsWith(path)) ?? "";

            if (!this.files.has(path)) {
                this.files.set(path, new Map());
            }

            const list = this.files.get(path);
            if (list && !list.has(file.path)) {
                list.set(file.path, file);
            }
        },

        removeFile(paths: string[], file: Photo): void {
            const path = paths.find((path) => file.path.startsWith(path)) ?? "";
            // Files is set. will not add duplicate file

            const list = this.files.get(path);
            if (list && list.has(file.path)) {
                list.delete(file.path);
            }
        },

        setCurrentFolder(folder: string): void {
            if (folder?.length > 0) {
                this.currentFolder = folder;
            }
        },

        updateFileList(key: string, fileList: Set<Photo>): void {
            const normalizedKey = mergePath(key, "");
            this.folderFiles[normalizedKey] = new Set([
                ...(this.folderFiles[normalizedKey] ?? []),
                ...fileList,
            ]);
        },

        removeFromFileList(photo: Photo): void {
            Object.keys(this.folderFiles).forEach((key) => {
                for (const item of this.folderFiles[key]) {
                    if (item.path === photo.path) {
                        this.folderFiles[key].delete(item);
                    }
                }
            });
        },

        getFolderFiles(key: string): Set<Photo> {
            const normalizedKey = mergePath(key, "");
            return this.folderFiles[normalizedKey] || new Set();
        },
    },
});
