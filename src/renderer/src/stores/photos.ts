import { defineStore } from "pinia";
import type { Photo } from "@common/config-types";
import { loggers } from "@common/logger";
const logger = loggers.fangxuanling;

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
            logger.info("📚 设置当前文件夹", folder);
            if (folder?.length > 0) {
                this.currentFolder = folder;
            }
        },
    },
});
