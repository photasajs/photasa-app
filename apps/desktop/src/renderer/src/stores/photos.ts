import { defineStore } from "pinia";
import type { Photo } from "@common/config-types";
import { loggers } from "@common/logger";
const logger = loggers.fangxuanling;

type PhotoState = {
    files: Map<string, Map<string, Photo>>; // Photasa Config file list
    currentFolder: string;
    processingFile: string; // ✅ RFC 0057: 当前正在扫描的文件路径
    scanProgress: number; // ✅ RFC 0057: 当前扫描进度（已处理文件数）
    folderFiles: Record<string, Set<Photo>>;
};

export const usePhotosStore = defineStore("photos", {
    state: (): PhotoState => {
        const files = new Map();
        return {
            files,
            currentFolder: "",
            processingFile: "",
            scanProgress: 0,
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

        /**
         * ✅ RFC 0057: 更新扫描进度（文件级）
         * 虞世南秘书监记录当前扫描的文件和进度
         *
         * @param filePath 当前扫描的文件路径
         * @param progress 已处理文件数
         */
        updateScanProgress(filePath: string, progress: number): void {
            logger.debug(`📚 典籍库：虞世南记录 - 正在审阅 ${filePath}，进度 ${progress}`);
            this.processingFile = filePath;
            this.scanProgress = progress;
        },

        /**
         * ✅ RFC 0057: 清空扫描进度
         * 扫描完成或取消时清空文件级进度
         */
        clearScanProgress(): void {
            logger.debug("📚 典籍库：虞世南记录 - 清空审阅记录");
            this.processingFile = "";
            this.scanProgress = 0;
        },
    },
});
