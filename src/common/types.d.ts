declare module "is-video";

/**
 * Electron API
 */
import type { ElectronAPI } from "@electron-toolkit/preload";

/**
 * 监听动作
 */
export type WatchAction = "add" | "change" | "delete" | "error" | "ready" | "raw";

/**
 * 监听配置
 */
export interface WatchConfig {
    path: string;
    recursive: boolean;
    paths: string[];
}

/**
 * 监听回调
 */
export type WatchCallback = (state: WatchState) => void;

/**
 * 监听状态
 */
export interface WatchState {
    action: WatchAction; // 监听动作
    isFile: boolean; // 是否为文件
    path: string; // 路径
    error?: Error; // 错误
    isImage: boolean; // 是否为图片
    isVideo: boolean; // 是否为视频
    thumbnail: string; // 缩略图路径
    isNotify?: boolean; // 是否通知
}

/**
 * 导入回调
 */
export type ImportCallback = (param: { type: string; error?: null; action: FileAction }) => void;

/**
 * 扫描回调
 */
export type ScanCallback = (action: ScanArgs) => void;

/**
 * 加载回调
 */
export type LoadCallback = (action: string, paths: string[]) => void;

/**
 * 配置回调
 */
export type ConfigCallback = (action: string, paths: string[]) => void;

export type PathName =
    | "home"
    | "desktop"
    | "documents"
    | "downloads"
    | "music"
    | "pictures"
    | "videos";

/**
 * 文件动作
 */
interface FileAction {
    file: string;
    name: string;
    created?: Date;
    targetName?: string;
    isImage: boolean;
    isVideo: boolean;
    target?: string;
    targetDir: string;
    targetFileName: string;
    targetFullPath: string;
}

/**
 * 文件异常
 */
interface FileException {
    code?: string;
}

/**
 * 照片动作
 */
interface PhotoAction {
    action: string;
    params: Record<string, object>;
    previous: string;
}

/**
 * 照片
 */
interface Photo {
    path: string; // relative path
    thumbnail: string;
    isVideo: boolean;
    history: PhotoAction[];
}

/**
 * 照片路径
 */
interface PhotoFileRequest {
    path: string;
    thumbnail: string;
    isImage: boolean;
    isVideo: boolean;
}

/**
 * Photasa 配置
 */
interface PhotasaConfig {
    version: string;
    photoList: Photo[];
    lastModified: number;
}

/**
 * Photasa 配置结果
 */
interface PhotasaConfigResult {
    path: string;
    config: PhotasaConfig;
}

/**
 * 扫描请求
 */
interface ScanAction {
    path: string; // 扫描路径
    action: "scan" | "rescan" | "current"; // scan: new folder, rescan: existing folder, current: only current folder
    thumbnailSize: number; // 缩略图大小
}

/**
 * 扫描参数
 */
interface ScanArgs {
    type: "next" | "error" | "complete"; // 扫描类型
    requestId: string; // 请求 ID
    action?: PhotoFileRequest; // 照片路径
    error?: {
        message: string;
    };
}

/**
 * 图片类型结果
 */
export type ImageTypeResult = "jpeg" | "png" | "gif" | "webp" | "tiff" | "unknown";

/**
 * 标签
 */
export type Tags = Record<string, any>;

/**
 * Icc 标签
 */
export type IccTags = Record<string, any>;

/**
 * Xmp 标签
 */
export type XmpTags = Record<string, any>;

/**
 * 图片信息
 */
interface ImageInfo {
    imageType: ImageTypeResult;
    tags: Tags | IccTags | XmpTags | undefined;
}

/**
 * 目录选择
 */
interface DirectorySelection {
    filePaths: string[];
}

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
