// 类型唯一共享模块，供主进程与 worker 端 import

/**
 * 通用 worker 消息协议
 */
export interface WorkerMessage<T = unknown> {
    // T can be any type depending on the action
    id: string; // 唯一任务ID
    action: string; // 动作类型
    payload: T; // 任务参数
}

export interface WorkerResponse<R = unknown> {
    // R can be any type depending on the result
    id: string; // 唯一任务ID
    result?: R; // 任务结果
    error?: string; // 错误信息
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
    data?: unknown; // Related data, can be of various types depending on the notification context // 相关数据
    error?: string; // 错误信息
    timestamp: number; // 时间戳
}

/**
 * 图片类型结果
 */
export type ImageTypeResult = "jpeg" | "png" | "gif" | "webp" | "tiff" | "unknown";

/**
 * 标签
 */
export type Tags = Record<string, unknown>; // EXIF tags can have various data types

/**
 * Icc 标签
 */
export type IccTags = Record<string, unknown>; // ICC tags can have various data types

/**
 * Xmp 标签
 */
export type XmpTags = Record<string, unknown>; // XMP tags can have various data types

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
 * 导入回调
 */
export type ImportCallback = (param: { type: string; error?: null; action: FileAction }) => void;

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
 * 位置
 */
export interface Position {
    x: number;
    y: number;
}
