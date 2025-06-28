declare module "is-video";

import type {
    WatchConfig,
    WatchCallback,
    ImportCallback,
    PathName,
    PhotasaConfig,
    ScanAction,
    ScanArgs,
    DirectorySelection,
    ImageInfo,
} from "./types";

/**
 * Electron API
 */
import type { ElectronAPI } from "@electron-toolkit/preload";

/**
 * 全局声明
 */
declare global {
    interface Window {
        electron: ElectronAPI;
        __heic2any__worker: Worker;
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
            // 打开文件夹
            openInFinder: (path: string) => void;
            // 获取 Photasa 配置
            getPhotasaConfig: (folder: string) => Promise<PhotasaConfig>;
            // 添加到照片列表
            addToPhotoList: (photo: string) => Promise<{ path: string; config: PhotasaConfig }>;
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
        };
    }
}

/**
 * 缩略图请求
 */
interface ThumbnailRequest {
    path: string; // 源文件路径
    thumbnail: string; // 缩略图路径
    width: number; // 缩略图宽度
    height: number; // 缩略图高度
    always?: boolean; // 是否总是创建缩略图
    preview: string; // 预览图片路径
    withoutEnlargement?: boolean; // 是否不放大缩略图
}

/**
 * 缩略图响应
 */
export type ThumbnailResponse = {
    success: boolean;
    file?: string;
    error?: string;
};

// 缩略图 worker 消息 action 类型
export type ThumbnailWorkerAction = "create" | "remove";

/**
 * 缩略图 worker 消息体
 */
export interface ThumbnailWorkerMessage {
    action: ThumbnailWorkerAction;
    arg: ThumbnailRequest;
    queueId?: number;
}

/**
 * 缩略图 worker 响应体
 */
export interface ThumbnailWorkerResponse extends ThumbnailResponse {
    queueId?: number;
}

/**
 * 缩略图服务动作
 */
export enum ThumbnailServiceAction {
    create = "picasa:create-thumbnail",
    remove = "picasa:remove-thumbnail",
}
