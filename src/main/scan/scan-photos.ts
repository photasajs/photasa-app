import klaw from "klaw";
import { Observable, Subscriber, concatMap } from "rxjs";
import isImage from "is-image";
import isVideo from "is-video";
import { shouldIgnorePhotasaPath } from "@common/utils";
import { buildThumbnailPath, isHiddenFile } from "@shared/path-util";
import type { ScanAction, PhotoFileRequest } from "@common/scan-types";
import type { ThumbnailRequest, ThumbnailResponse } from "@common/thumbnail-types";
import { addToPhotasaConfig, getPhotasaConfig } from "../config/config-storage";
import fs from "fs-extra";
import path from "path";
import { WorkerPool } from "../workers/worker-pool";
import createWorker from "../thumbnail/thumbnail-worker?nodeWorker";
import { loggers, PhotasaLogger } from "@common/logger";
import type { WorkerOptions } from "worker_threads";
import { app } from "electron";
const logger = loggers.scan;

const THUMBNAIL_WORKER_CONFIG = {
    minWorkers: 2,
    maxWorkers: 4,
    createWorker: (options?: unknown) => {
        return createWorker({
            ...(options as WorkerOptions),
            env: {
                ...process.env,
                APP_PATH: app.getAppPath(),
            },
        });
    },
};

/**
 * 初始化缩略图 worker 池
 * @param logger - 日志记录器
 * @returns 缩略图 worker 池
 */
let workerPoolInstance: WorkerPool<ThumbnailRequest, ThumbnailResponse> | null = null;

/**
 * 初始化缩略图 worker 池
 * @param logger - 日志记录器
 * @returns 缩略图 worker 池
 */
function getWorkerPool(logger: PhotasaLogger): WorkerPool<ThumbnailRequest, ThumbnailResponse> {
    if (!workerPoolInstance) {
        workerPoolInstance = new WorkerPool(THUMBNAIL_WORKER_CONFIG, logger);
    }
    return workerPoolInstance;
}

/**
 * Whether only scan current folder or scan all sub folders.
 */
function shouldScanOneLevel(action: string): boolean {
    return action == "current" || action == "rescan" || action == "scan";
}

/**
 * 判断文件是否需要处理
 * 如果 rescan 动作，则需要处理
 * 如果 .photasa.json 不存在，则需要处理
 * 如果 .photasa.json 存在，则需要检查文件是否在配置中
 * 如果文件在配置中，则不需要处理
 * 如果文件不在配置中，则需要处理
 * 如果文件在配置中，则不需要处理 photoList 保存的是文件名，而不是路径
 * @param filePath - 文件路径
 * @param action - 扫描动作
 * @returns 是否需要处理
 */
async function shouldProcessFile(filePath: string, action: string): Promise<boolean> {
    // 总是处理 rescan 动作
    if (action === "rescan") {
        return true;
    }

    // 检查 .photasa.json 是否存在
    const dir = path.dirname(filePath);
    const configPath = path.join(dir, ".photasa.json");

    // 如果 .photasa.json 不存在，则需要处理
    if (!fs.existsSync(configPath)) {
        return true;
    }

    // 检查文件是否在配置中
    const config = await getPhotasaConfig(dir, logger);
    // 获取文件名
    const fileName = path.basename(filePath);
    // 如果文件在配置中，则不需要处理 photoList 保存的是文件名，而不是路径
    return !config.photoList.some((photo) => photo.path === fileName);
}

/**
 * 遍历文件夹，忽略隐藏文件、photasa 文件和子文件夹
 * @param source - 扫描动作
 * @returns 照片路径
 */
export function walkthroughPhotos(source: ScanAction): Observable<PhotoFileRequest> {
    return new Observable<PhotoFileRequest>((subscriber: Subscriber<PhotoFileRequest>) => {
        // Only scan current folder
        const option = {
            depthLimit: shouldScanOneLevel(source.action) ? 0 : -1,
            filter: (item: string): boolean => {
                return (
                    !shouldIgnorePhotasaPath(item) && // Skip ignored path
                    !isHiddenFile(item) // Skip hidden file
                );
            },
        };
        klaw(source.path, option)
            .on("data", (item) => {
                const video = isVideo(item.path);
                const image = isImage(item.path);

                // 只推送图片/视频文件节点，不再推送目录节点
                if (
                    !item.stats.isDirectory() && // 只处理文件
                    item.path !== source.path && //  Skip self
                    (video || image) // 只处理图片或视频
                ) {
                    subscriber.next({
                        path: item.path,
                        thumbnail: buildThumbnailPath(item.path),
                        isImage: image,
                        isVideo: video,
                        isDirectory: false,
                    });
                }
                // 目录节点不再推送
            })
            .on("end", () => {
                subscriber.complete();
            });
    });
}

/**
 * 扫描照片，处理文件，创建缩略图，添加到配置中
 * @param scan - 扫描动作
 * @param logger - 日志记录器
 * @returns 照片路径
 */
export function scanPhotos(scan: ScanAction, logger: PhotasaLogger): Observable<PhotoFileRequest> {
    const workerPool = getWorkerPool(logger);

    return walkthroughPhotos(scan).pipe(
        concatMap(async (action: PhotoFileRequest) => {
            // 检查文件是否需要处理
            const shouldProcess = await shouldProcessFile(action.path, scan.action);

            // 如果文件不需要处理，则跳过
            if (!shouldProcess) {
                return action;
            }

            // 检查缩略图是否存在
            const thumbnailExists = fs.existsSync(action.thumbnail);

            // 如果缩略图不存在，或者扫描动作是 rescan，则创建缩略图
            if (!thumbnailExists || scan.action === "rescan") {
                await workerPool.addTask("create", {
                    path: action.path,
                    thumbnail: action.thumbnail,
                    width: scan.thumbnailSize,
                    height: scan.thumbnailSize,
                    withoutEnlargement: true,
                    preview: action.thumbnail,
                    always: false,
                });
            } else {
            }

            // 添加到配置中

            await addToPhotasaConfig(
                {
                    queueId: 0,
                    paths: [action.path],
                },
                () => {},
                logger,
            );

            return action;
        }),
    );
}

/**
 * 清理函数，当应用关闭时调用
 */
export async function cleanup(): Promise<void> {
    if (workerPoolInstance) {
        await workerPoolInstance.shutdown();
        workerPoolInstance = null;
    }
}
