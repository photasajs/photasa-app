import { parentPort } from "worker_threads";
import { createThumbnail, removeThumbnail } from "./thumbnail-handler";
import { loggers } from "@common/logger";
import type {
    ThumbnailRequest,
    ThumbnailResponse,
    WorkerMessage,
    WorkerResponse,
} from "@common/types";

const logger = loggers.worker;

parentPort?.on("message", async (message: WorkerMessage<ThumbnailRequest>) => {
    logger.debug(`[thumbnail-worker] 收到消息: ${JSON.stringify(message)}`);
    try {
        if (message.action === "create") {
            logger.debug(`[thumbnail-worker] 创建缩略图: ${JSON.stringify(message)}`);
            const request = message.payload;
            const result = await createThumbnail(request, logger);
            const response: WorkerResponse<ThumbnailResponse> = {
                id: message.id,
                result: {
                    success: true,
                    file: result.thumbnail,
                },
            };
            parentPort?.postMessage(response);
        } else if (message.action === "remove") {
            logger.debug(`[thumbnail-worker] 删除缩略图: ${JSON.stringify(message)}`);
            const request = message.payload;
            const result = await removeThumbnail(request, logger);
            const response: WorkerResponse<ThumbnailResponse> = {
                id: message.id,
                result: {
                    success: true,
                    file: result.thumbnail,
                },
            };
            parentPort?.postMessage(response);
        } else {
            logger.debug(`[thumbnail-worker] 未知操作: ${JSON.stringify(message)}`);
            parentPort?.postMessage({
                id: message.id,
                result: {
                    success: false,
                    error: "Unknown action",
                },
            } as WorkerResponse<ThumbnailResponse>);
        }
    } catch (error) {
        parentPort?.postMessage({
            id: message.id,
            result: {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
        } as WorkerResponse<ThumbnailResponse>);
    }
});
