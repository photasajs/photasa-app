import klaw from "klaw";
import path from "path";
import type { FileAction } from "@photasa/common";
import { from, map, mergeMap, Observable, Subscriber } from "rxjs";
import fs from "fs-extra";
import { resolveExifDate } from "./exif-helper";
import isImage from "is-image";
import isVideo from "is-video";
import { shouldIgnorePhotasaPath } from "@photasa/common";
import { buildThumbnailPath } from "@shared/path-util";
import type { ScanAction, PhotoPath } from "@photasa/common";
import {
    isFileUnderFolder,
    toFileName,
    normalizePath,
    mergePath,
    toDirName,
    toExtName,
    relativePath,
    resolvePath,
    isAbsolutePath,
    isHiddenFile,
    isDirectory,
    isFile,
} from "@shared/path-util";

export {
    isFileUnderFolder,
    toFileName,
    normalizePath,
    mergePath,
    toDirName,
    toExtName,
    relativePath,
    resolvePath,
    isAbsolutePath,
    isHiddenFile,
    isDirectory,
    isFile,
};

/**
 * 平台无关的路径分割，将路径字符串按当前平台分隔符拆分为数组
 * @param inputPath - 需要分割的路径字符串
 * @returns 分割后的路径片段数组
 */
export function splitPath(inputPath: string): string[] {
    // 使用 path.sep 进行分割，兼容 Windows 和 POSIX
    return inputPath.split(path.sep).filter(Boolean);
}

/**
 * 平台无关的路径拼接，将多个路径片段合并为一个完整路径
 * @param parts - 路径片段
 * @returns 合并后的完整路径
 */
export function joinPath(...parts: string[]): string {
    return path.join(...parts);
}

/**
 * 获取当前平台的路径分隔符
 * @returns 分隔符字符串（如 '/' 或 '\\'）
 */
export function getSeparator(): string {
    return path.sep;
}

export interface PathOption {
    root?: string;
}

export interface FileException {
    code?: string;
}

/**
 * Combines a file path with an optional root path
 * @param filepath - The file path to process
 * @param options - Optional configuration including root path
 * @returns The full path combining root and filepath if root is provided
 */
export function toFullPath(filepath: string, options: PathOption): string {
    const _options = options || {};
    const root = _options.root;
    return root ? path.join(root, filepath) : filepath;
}

/**
 * Ensures a directory exists, creating it if necessary
 * @param action - The file action containing target directory information
 * @returns Observable that emits the completed file action
 */
export function ensureDir(action: FileAction): Observable<FileAction> {
    action.targetDir = path.join(action.target ?? "", action.targetName ?? "");
    const promise = new Promise<FileAction>((resolve) => {
        fs.ensureDir(action.targetDir, () => {
            resolve(action);
        });
    });
    return from(promise);
}

/**
 * Scans a folder for files and processes them
 * Uses klaw to walk through the directory tree and process each file
 * @param source - The source directory to scan
 * @param target - The target directory for processed files
 * @returns Observable that emits FileAction events for each file found
 */
export function scanFolder(source: string, target: string): Observable<FileAction> {
    return new Observable<FileAction>((subscriber: Subscriber<FileAction>) => {
        klaw(source, {
            filter: (item) => {
                return (
                    !shouldIgnorePhotasaPath(item) && // 跳过photasa缓存路径
                    !isHiddenFile(item) // 跳过隐藏文件
                );
            },
        })
            .on("data", (item) => {
                if (!item.stats.isDirectory()) {
                    subscriber.next({
                        file: item.path,
                        name: path.basename(item.path),
                        created: item.stats.birthtime,
                        target,
                        isImage: false,
                        isVideo: false,
                        targetDir: "",
                        targetFileName: "",
                        targetFullPath: "",
                    });
                }
            })
            .on("end", () => {
                subscriber.complete();
            });
    }).pipe(
        map((action: FileAction) => {
            action.isImage = isImage(action.file);
            action.isVideo = isVideo(action.file);
            return action;
        }),
        mergeMap((action: FileAction) => resolveExifDate(action)),
    );
}

/**
 * Determines if the scan action is for the current directory only
 * @param action - The scan action to check
 * @returns true if action is 'current' or 'rescan', false otherwise
 */
function isScanCurrent(action: string): boolean {
    return action == "current" || action == "rescan";
}

/**
 * Walks through files in a folder, filtering out hidden files and photasa files
 * Uses klaw to traverse the directory tree with configurable depth
 *
 * Features:
 * - Configurable scan depth (current directory or recursive)
 * - Filters out hidden files and photasa-specific paths
 * - Skips directories and the source path itself
 * - Identifies image and video files
 * - Generates thumbnail paths
 *
 * @param source - The source directory and scan action configuration
 * @returns Observable that emits PhotoPath events for each valid file found
 */
export function walkthroughFiles(source: ScanAction): Observable<PhotoPath> {
    return new Observable<PhotoPath>((subscriber: Subscriber<PhotoPath>) => {
        // Only scan current folder
        klaw(source.path, {
            depthLimit: isScanCurrent(source.action) ? 0 : -1,
            filter: (item) => {
                return (
                    !shouldIgnorePhotasaPath(item) && // Skip ignored path
                    !isHiddenFile(item) // Skip hidden file
                );
            },
        })
            .on("data", (item) => {
                if (
                    !item.stats.isDirectory() && // Skip directory
                    item.path !== source.path //  Skip self
                ) {
                    subscriber.next({
                        path: item.path,
                        thumbnail: buildThumbnailPath(item.path),
                        isImage: isImage(item.path),
                        isVideo: isVideo(item.path),
                    });
                }
            })
            .on("end", () => {
                subscriber.complete();
            });
    });
}
