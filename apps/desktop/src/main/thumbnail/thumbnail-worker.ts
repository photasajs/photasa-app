import { parentPort } from "worker_threads";
import { createThumbnail, removeThumbnail } from "@photasa/thumbnail";
import { loggers } from "@photasa/common";
import { createResponse } from "@photasa/common";
import type { WorkerMessage } from "@photasa/common";
import type { ThumbnailRequest, ThumbnailResponse } from "@photasa/common";
import {
    createWorkerLogViewerBridge,
    handleLogViewerStatusMessage,
} from "../workers/worker-log-viewer-bridge";

const logger = loggers.thumbnail;

const THUMBNAIL_WORKER_THREAD_ID = "thumbnail-worker";

const port = parentPort;
if (!port) {
    // 在测试环境中可能没有parentPort，只在生产环境中抛出错误
    if (process.env.NODE_ENV !== "test") {
        throw new Error("IllegalState");
    }
}

const thumbnailLogBridge = createWorkerLogViewerBridge({
    port,
    baseLogger: {
        debug: (m) => logger.debug(m),
        info: (m) => logger.info(m),
        warn: (m) => logger.warn(m),
        error: (m) => logger.error(m),
    },
    threadId: THUMBNAIL_WORKER_THREAD_ID,
});
const { workerLog, createCategoryLogger } = thumbnailLogBridge;

const wrappedLogger = createCategoryLogger(THUMBNAIL_WORKER_THREAD_ID) as any;

parentPort?.on("message", async (message: WorkerMessage<ThumbnailRequest> | any) => {
    // FFmpeg 配置已通过环境变量设置，无需处理配置消息

    if (handleLogViewerStatusMessage(message, thumbnailLogBridge, THUMBNAIL_WORKER_THREAD_ID)) {
        return;
    }

    // 处理标准的 thumbnail 消息
    workerLog(
        "debug",
        "thumbnail-worker",
        `Starting thumbnail task: id=${message.id}, action=${message.action}`,
    );
    try {
        if (message.action === "create") {
            workerLog(
                "debug",
                "thumbnail-worker",
                `Creating thumbnail for: ${message.payload.path}`,
            );
            const result = await createThumbnail(message.payload, wrappedLogger);
            const response = createResponse<ThumbnailRequest, ThumbnailResponse>(message, {
                success: true,
                file: result.thumbnail,
            });
            parentPort?.postMessage(response);
        } else if (message.action === "remove") {
            workerLog(
                "debug",
                "thumbnail-worker",
                `Removing thumbnail for: ${message.payload.path}`,
            );
            const result = await removeThumbnail(message.payload, wrappedLogger);
            const response = createResponse<ThumbnailRequest, ThumbnailResponse>(message, {
                success: true,
                file: result.thumbnail,
            });
            parentPort?.postMessage(response);
        } else {
            workerLog("warn", "thumbnail-worker", `Unknown action: ${message.action}`);
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
