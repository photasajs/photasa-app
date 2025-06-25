import { useTask } from "vue-concurrency";
import { createThumbnailTask, scanPhotos, addToPhotoList } from "@renderer/utils/api";
import type { ScanAction, ScanArgs } from "src/preload/types";
import { loggers } from "@common/logger";

const logger = loggers.scan;

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
            width: (args as any).thumbnailSize ?? 200,
            height: (args as any).thumbnailSize ?? 200,
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
