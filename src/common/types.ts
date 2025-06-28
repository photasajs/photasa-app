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
