import { watch } from "vue";
import { useTask } from "vue-concurrency";
import { createThumbnailTask, scanPhotos, addToPhotoList } from "@renderer/utils/api";
import type { ScanAction, ScanArgs } from "@photasa/common";
import { loggers } from "@photasa/common";

const logger = loggers.scan;

/**
 * 等待任务进入空闲状态
 * @param task - 具有 isIdle 属性的任务对象
 * @returns Promise，当任务空闲时 resolve
 */
export function waitForTaskIdle(task: { isIdle: boolean }): Promise<void> {
    // 如果已经空闲，立即返回
    if (task.isIdle) {
        return Promise.resolve();
    }

    // 监听 isIdle 变化，当变为 true 时 resolve
    return new Promise((resolve) => {
        const unwatch = watch(
            () => task.isIdle,
            (isIdle) => {
                if (isIdle) {
                    unwatch(); // 自动清理监听器
                    resolve();
                }
            },
            { immediate: false }, // 不立即执行，等待变化
        );
    });
}

export const processScannedFileTask = useTask(function* (_, args: ScanArgs) {
    const photo = args.action;
    if (!photo || !photo.path) {
        logger.warn("No path in scan args:", args);
        return;
    }

    try {
        // Create a thumbnail
        logger.debug("Creating thumbnail for:", photo.path);
        yield createThumbnailTask.perform({
            path: photo.path,
            thumbnail: photo.path, // Use the same path for thumbnail
            width: (args as unknown as { thumbnailSize: number }).thumbnailSize ?? 200,
            height: (args as unknown as { thumbnailSize: number }).thumbnailSize ?? 200,
            preview: "",
        });

        // Save to .photasa.json
        logger.debug("Adding to photo list:", photo.path);
        addToPhotoList(photo.path);
    } catch (error) {
        logger.error("Error processing scanned file:", error);
        throw error;
    }
})
    .enqueue()
    .maxConcurrency(1);

export const scanPhotosTask = useTask(function* (_, folder: ScanAction) {
    logger.debug("Starting scan for folder:", folder);
    try {
        if (!folder.path) {
            throw new Error("No path provided for scanning");
        }

        logger.debug("Calling scanPhotos with:", folder);
        const result = yield scanPhotos(folder);
        logger.debug("Scan completed for folder:", folder, "result:", result);
        return result;
    } catch (error) {
        logger.error("Scan failed for folder:", folder, "error:", error);
        throw error;
    }
})
    .enqueue()
    .maxConcurrency(1);
