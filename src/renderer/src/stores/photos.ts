// stores/photos.js
import { defineStore } from "pinia";
import type { Photo } from "@renderer/utils/folder-tree";
import { mergePath } from "@renderer/utils/path";

type PhotoState = {
    files: Map<string, Set<Photo>>;
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
        addFile(paths: string[], file: Photo): void {
            const path = paths.find((path) => file.path.startsWith(path)) ?? "";
            // Files is set. will not add duplicate file
            if (!this.files.has(path)) {
                this.files.set(path, new Set());
            }
            this.files.get(path)?.add(file);
        },
        removeFile(paths: string[], file: Photo): void {
            const path = paths.find((path) => file.path.startsWith(path)) ?? "";
            // Files is set. will not add duplicate file

            const files = this.files.get(path);
            if (files) {
                files.forEach((item) => {
                    if (item.path === file.path) {
                        files.delete(item);
                    }
                });
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
