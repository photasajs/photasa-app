// 类型唯一共享模块，供主进程与 worker 端 import

export interface ThumbnailRequest {
    path: string; // 源文件路径
    thumbnail: string; // 缩略图路径
    width: number; // 缩略图宽度
    height: number; // 缩略图高度
    always?: boolean; // 是否总是创建缩略图
    preview: string; // 预览图片路径
    withoutEnlargement?: boolean; // 是否不放大缩略图
}

export type ThumbnailResponse = {
    success: boolean;
    file?: string;
    error?: string;
};

export type ThumbnailWorkerAction = "create" | "remove";

export interface ThumbnailWorkerMessage {
    action: ThumbnailWorkerAction;
    arg: ThumbnailRequest;
    queueId?: number;
}

export interface ThumbnailWorkerResponse extends ThumbnailResponse {
    queueId?: number;
}

export enum ThumbnailServiceAction {
    create = "picasa:create-thumbnail",
    remove = "picasa:remove-thumbnail",
}

/**
 * 通用 worker 消息协议
 */
export interface WorkerMessage<T = any> {
    id: string; // 唯一任务ID
    action: string; // 动作类型
    payload: T; // 任务参数
}

export interface WorkerResponse<R = any> {
    id: string; // 唯一任务ID
    result?: R; // 任务结果
    error?: string; // 错误信息
}

/**
 * 照片文件请求类型
 */
export interface PhotoFileRequest {
    path: string;
    thumbnail: string;
    isImage: boolean;
    isVideo: boolean;
}

/**
 * 扫描请求类型
 */
export interface ScanAction {
    path: string; // 扫描路径
    action: "scan" | "rescan" | "current"; // 扫描动作
    thumbnailSize: number; // 缩略图大小
}

/**
 * 视频大小
 */
export interface VideoSize {
    width: number;
    height: number;
}

/**
 * 通用 notify 状态推送 payload 类型
 */
export interface NotifyPayload {
    type: string; // 任务类型，如 scan/thumbnail/import
    task: string; // 具体任务名或ID
    status: string; // 状态，如 start/success/fail/progress/skip
    data?: any; // 相关数据
    error?: string; // 错误信息
    timestamp: number; // 时间戳
}

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
 * 照片路径
 */
export interface PhotoFileRequest {
    path: string;
    thumbnail: string;
    isImage: boolean;
    isVideo: boolean;
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
export interface ImageInfo {
    imageType: ImageTypeResult;
    tags: Tags | IccTags | XmpTags | undefined;
}

/**
 * 目录选择
 */
export interface DirectorySelection {
    filePaths: string[];
}

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
 * 扫描请求
 */
export interface ScanAction {
    path: string; // 扫描路径
    action: "scan" | "rescan" | "current"; // scan: new folder, rescan: existing folder, current: only current folder
    thumbnailSize: number; // 缩略图大小
}

/**
 * 扫描参数
 */
export interface ScanArgs {
    type: "next" | "error" | "complete"; // 扫描类型
    requestId: string; // 请求 ID
    action?: PhotoFileRequest; // 照片路径
    error?: {
        message: string;
    };
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

/**
 * 路径名称
 */
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
export interface FileAction {
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
export interface FileException {
    code?: string;
}

/**
 * 照片动作
 */
export interface PhotoAction {
    action: string;
    params: Record<string, object>;
    previous: string;
}

/**
 * 照片
 */
export interface Photo {
    path: string; // relative path
    thumbnail: string;
    isVideo: boolean;
    history: PhotoAction[];
}

/**
 * Photasa 配置
 */
export interface PhotasaConfig {
    version: string;
    photoList: Photo[];
    lastModified: number;
}

/**
 * Photasa 配置结果
 */
export interface PhotasaConfigResult {
    path: string | undefined;
    config: PhotasaConfig;
}
