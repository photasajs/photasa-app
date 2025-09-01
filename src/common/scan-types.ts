export interface PhotoPath {
    path: string;
    thumbnail: string;
    isImage: boolean;
    isVideo: boolean;
}

/**
 * 照片文件请求类型 包含照片路径、缩略图、是否为图片、是否为视频、是否为目录
 */
export interface PhotoFileRequest extends PhotoPath {
    isDirectory?: boolean;
}
/**
 * 扫描请求类型
 *
 * @description 扫描请求类型，包含扫描路径、扫描动作、缩略图大小
 * @author Photasa
 * @date 2025-08-31
 * @version 1.0.0
 * @copyright Copyright 2025 Photasa
 * @license MIT
 * @example
 * const scanAction: ScanAction = {
 *     path: "/path/to/scan",
 *     action: "scan",
 *     thumbnailSize: 100,
 * };
 * const scanRequest: ScanRequest = {
 *     action: "scan",
 *     requestId: "1234567890",
 *     scan: scanAction,
 * };
 * const scanResult: ScanResult = {
 *     path: "/path/to/scan",
 * };
 * const scanResponse: ScanResponse = {
 *     type: "scan",
 *     requestId: "1234567890",
 *     action: scanAction,
 * };
 * const scanArgs: ScanArgs = {
 *     type: "next",
 *     requestId: "1234567890",
 *     action: scanAction,
 *     error: {
 *         message: "error message",
 *     },
 * };
 * const scanCallback: ScanCallback = (action: ScanArgs) => {
 *     console.log(action);
 * };
 */
export interface ScanAction {
    path: string; // 扫描路径
    action: "scan" | "rescan" | "current"; // 扫描动作
    thumbnailSize: number; // 缩略图大小
}

export interface ScanRequest {
    action: "scan";
    requestId: string; // 请求 ID
    scan: ScanAction; // 扫描动作
}

export interface ScanResult {
    path: string;
}

export interface ScanResponse {
    type: "scan" | "error" | "complete" | "progress";
    requestId: string;
    action?: PhotoFileRequest | ScanResult;
    progress?: {
        processed: number;
        total: number;
    };
    error?: string;
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
 * 扫描回调
 */
export type ScanCallback = (action: ScanArgs) => void;
