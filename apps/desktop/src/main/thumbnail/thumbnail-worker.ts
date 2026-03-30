import { parentPort } from "worker_threads";
import { createThumbnail, removeThumbnail } from "@photasa/thumbnail";
import { loggers } from "@photasa/common";
import { createResponse } from "@photasa/common";
import type { WorkerMessage } from "@photasa/common";
import type { ThumbnailRequest, ThumbnailResponse } from "@photasa/common";

const logger = loggers.thumbnail;

const port = parentPort;
if (!port) {
    // 在测试环境中可能没有parentPort，只在生产环境中抛出错误
    if (process.env.NODE_ENV !== "test") {
        throw new Error("IllegalState");
    }
}

// 日志查看器状态
let logViewerActive = false;

// 包装日志函数以支持日志查看器
function workerLog(level: "debug" | "info" | "warn" | "error", category: string, message: string) {
    // 正常输出到控制台
    logger[level](message);

    // 仅在日志查看器激活时上报
    if (logViewerActive && port) {
        port.postMessage({
            type: "worker:log",
            entry: {
                timestamp: new Date().toISOString(),
                level,
                category,
                message,
                source: "worker",
                threadId: "thumbnail-worker",
            },
        });
    }
}

// 创建包装的 logger，将所有调用转发到 workerLog
const wrappedLogger = {
    debug: (message: string) => workerLog("debug", "thumbnail-worker", message),
    info: (message: string) => workerLog("info", "thumbnail-worker", message),
    warn: (message: string) => workerLog("warn", "thumbnail-worker", message),
    error: (message: string) => workerLog("error", "thumbnail-worker", message),
} as any; // 临时类型转换，因为我们只需要这四个方法

parentPort?.on("message", async (message: WorkerMessage<ThumbnailRequest> | any) => {
    // FFmpeg 配置已通过环境变量设置，无需处理配置消息

    // 处理日志查看器状态消息
    if (message.type === "log:viewer-status") {
        logViewerActive = message.active;
        workerLog(
            "debug",
            "thumbnail-worker",
            `Log viewer ${logViewerActive ? "activated" : "deactivated"}`,
        );
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
