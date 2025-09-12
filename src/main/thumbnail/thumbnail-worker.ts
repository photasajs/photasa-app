import { parentPort } from "worker_threads";
import { createThumbnail, removeThumbnail } from "./thumbnail-handler";
import { loggers } from "@common/logger";
import { createResponse } from "@common/worker-util";
import type { WorkerMessage } from "@common/types";
import type { ThumbnailRequest, ThumbnailResponse } from "@common/thumbnail-types";

const logger = loggers.worker;

parentPort?.on("message", async (message: WorkerMessage<ThumbnailRequest>) => {
    logger.debug(`[thumbnail-worker] 收到消息: id=${message.id}, action=${message.action}`);
    try {
        if (message.action === "create") {
            logger.debug(`[thumbnail-worker] 创建缩略图: ${message.payload.path}`);
            const result = await createThumbnail(message.payload, logger);
            const response = createResponse<ThumbnailRequest, ThumbnailResponse>(message, {
                success: true,
                file: result.thumbnail,
            });
            parentPort?.postMessage(response);
        } else if (message.action === "remove") {
            logger.debug(`[thumbnail-worker] 删除缩略图: ${message.payload.path}`);
            const result = await removeThumbnail(message.payload, logger);
            const response = createResponse<ThumbnailRequest, ThumbnailResponse>(message, {
                success: true,
                file: result.thumbnail,
            });
            parentPort?.postMessage(response);
        } else {
            logger.debug(`[thumbnail-worker] 未知操作: ${message.action}`);
            const response = createResponse<ThumbnailRequest, ThumbnailResponse>(message, {
                success: false,
                error: "Unknown action",
            });
            parentPort?.postMessage(response);
        }
    } catch (error) {
        const response = createResponse<ThumbnailRequest, ThumbnailResponse>(message, {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        });
        parentPort?.postMessage(response);
    }
});
