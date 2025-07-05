import klaw from "klaw";
import path from "path";
import type { FileAction } from "@common/types";
import { from, map, mergeMap, Observable, Subscriber } from "rxjs";
import fs from "fs-extra";
import { resolveExifDate } from "./exif-helper";
import isImage from "is-image";
import isVideo from "is-video";
import { shouldIgnorePhotasaPath } from "@common/utils";
import { buildThumbnailPath } from "@shared/path-util";
import type { ScanAction, PhotoPath } from "@common/scan-types";
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
        klaw(source)
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
