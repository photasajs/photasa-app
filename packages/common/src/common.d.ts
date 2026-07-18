import type {
    ImportCallback,
    PathName,
    PhotasaConfig,
    DirectorySelection,
    ImageInfo,
} from "./types";
import type {
    FileMetadata,
    ImportHistory,
    ImportProgress,
    RecoverableImport,
    RecoverableImportActionResult,
    UndoPreview,
    UndoResult,
} from "./import-types";
import type { WatchConfig, WatchCallback } from "./watch-types";
import type { ScanAction, ScanArgs } from "./scan-types";
import type { ThumbnailRequest } from "./thumbnail-types";

/**
 * Electron API
 */

/**
 * 全局声明
 */
declare global {
    interface Window {
        electron: ElectronAPI;

        tianshu: {
            processCommand: (command: unknown) => Promise<unknown>;
            getStatus: () => Promise<unknown>;
            onProgress: (callback: (progress: unknown) => void) => () => void;
            onStatus: (callback: (status: unknown) => void) => () => void;
        };
        api: {
            // 开始监听
            startWatching: (config: WatchConfig, callback: WatchCallback) => void;
            // 停止监听
            stopWatching: () => Promise<void>;
            // 导入照片
            importPhotos: (paths: string[], target: string, callback: ImportCallback) => void;
            // 扫描照片
            scanPhotos: (folder: ScanAction) => Promise<ScanArgs>;
            // 选择目录
            chooseDirectory: () => Promise<DirectorySelection>;
            // 获取目录
            getDirectory: (name: PathName) => Promise<string>;
            // 创建缩略图
            createThumbnail: (request: ThumbnailRequest) => Promise<ThumbnailRequest>;
            // 删除缩略图
            removeThumbnail: (request: ThumbnailRequest) => Promise<ThumbnailRequest>;
            // 获取图片类型
            getImageType: (path: string) => Promise<ImageInfo>;
            getFileMetadata: (pathOrUrl: string) => Promise<FileMetadata>;
            // ✅ RFC 0058: openInFinder 已迁移到服务架构，使用 useZhangSunWuJi().openInFinder()
            // 获取 Photasa 配置
            getPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
            // 添加到照片列表
            addToPhotoList: (photo: string) => Promise<void>;
            removeFromPhotoList: (
                photo: string,
            ) => Promise<{ path: string; config: PhotasaConfig }>;
            // 扫描子文件夹
            scanSubfolders: (folder: string) => Promise<string[]>;
            // 判断文件是否在文件夹下
            isFileUnderFolder: (file: string, folder: string) => boolean;
            // 缩略图名称
            toThumbnailName: (file: string) => string;
            // 缩短缩略图名称
            shortenThumbnailName: (file: string) => string;
            // 文件名称
            toFileName: (file: string) => string;
            // 修复 Photasa 配置
            fixPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
            // 重置 Photasa 配置
            resetPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
            // 隐藏文件
            isHiddenFile: (fileName: string) => boolean;
            // 忽略 Photasa 路径
            shouldIgnorePhotasaPath: (fileName: string) => boolean;
            // 判断文件是否为视频
            isVideoFile: (filePath: string) => boolean;
            // 判断文件是否为图片
            isImageFile: (filePath: string) => boolean;
            // 文件 URL 从路径
            fileUrlFromPath: (file: string) => string;
            // 清理扫描队列
            cleanupScanQueue: (folderPath: string) => void;
            getImportHistory: (limit?: number) => Promise<ImportHistory[]>;
            getImportDetails: (historyId: string) => Promise<ImportHistory | null>;
            getImportProgress: (importId: string) => Promise<ImportProgress>;
            previewUndo: (historyId: string) => Promise<UndoPreview>;
            undoImport: (historyId: string) => Promise<UndoResult>;
            getRecoverableImports: () => Promise<RecoverableImport[]>;
            cleanupRecoverableImport: (importId: string) => Promise<RecoverableImportActionResult>;
            keepRecoverableImport: (importId: string) => Promise<RecoverableImportActionResult>;
        };
    }
}
