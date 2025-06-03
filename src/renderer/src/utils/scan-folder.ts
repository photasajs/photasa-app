import { useTask } from "vue-concurrency";
import { createThumbnailTask, scanPhotos, addToPhotoList } from "@renderer/utils/api";
import type { ScanAction, ScanArgs } from "src/preload/types";
import { loggers } from "@common/logger";

const logger = loggers.scan;

export const processScannedFileTask = useTask(function* (_, args: ScanArgs, thumbnailSize: number) {
    if (!args.action?.path) {
        logger.warn("No path in scan args:", args);
        return;
    }

    try {
        // Create a thumbnail
        logger.debug("Creating thumbnail for:", args.action.path);
        yield createThumbnailTask.perform({
            path: args.action?.path as string,
            thumbnail: args.action?.thumbnail as string,
            width: thumbnailSize,
            height: thumbnailSize,
            preview: "",
        });

        // Save to .photasa.json
        logger.debug("Adding to photo list:", args.action.path);
        addToPhotoList(args.action.path);
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
