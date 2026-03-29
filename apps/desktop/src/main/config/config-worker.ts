import { parentPort } from "worker_threads";
import { queryConfig, addConfig, removeConfig } from "@photasa/config-core";
import { WorkerError, handleError } from "@photasa/common";
import type { ConfigRequest, ConfigResponse, ConfigHandlers } from "@photasa/common";
import { loggers } from "@photasa/common";

const port = parentPort;
if (!port) {
    // 在测试环境中可能没有parentPort，只在生产环境中抛出错误
    if (process.env.NODE_ENV !== "test") {
        throw new WorkerError("Worker port is not available");
    }
}

const logger = loggers.config;

// 日志查看器状态
let logViewerActive = false;

/**
 * 包装日志函数以支持日志查看器
 * @param level - 日志级别
 * @param category - 日志分类
 * @param message - 日志消息
 */
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
                threadId: "config-worker",
            },
        });
    }
}

const handler: ConfigHandlers = {
    query: queryConfig,
    add: addConfig,
    remove: removeConfig,
};

port?.on("message", (message: any) => {
    // 处理日志查看器状态消息
    if (message.type === "log:viewer-status") {
        logViewerActive = message.active;
        workerLog(
            "debug",
            "config-worker",
            `Log viewer ${logViewerActive ? "activated" : "deactivated"}`,
        );
        return;
    }

    try {
        // 处理字符串消息（向后兼容）
        const messageData = typeof message === "string" ? message : JSON.stringify(message);
        const result = JSON.parse(messageData) as ConfigRequest;
        const action = result.action;

        workerLog("debug", "config-worker", `Processing config action: ${action}`);

        if (!handler[action]) {
            throw new WorkerError(`Unknown action: ${action}`);
        }

        handler[action]?.call(
            this,
            result,
            (response: string) => {
                port?.postMessage(response);
            },
            // 传递包装的logger以支持LogViewerService
            {
                debug: (msg: string) => workerLog("debug", "config-worker", msg),
                info: (msg: string) => workerLog("info", "config-worker", msg),
                warn: (msg: string) => workerLog("warn", "config-worker", msg),
                error: (msg: string) => workerLog("error", "config-worker", msg),
            } as any,
        );
    } catch (error) {
        workerLog("error", "config-worker", `Failed to process worker message: ${error}`);
        handleError(
            new WorkerError("Failed to process worker message", { error }),
            logger,
            "config-worker",
        );
        const errorResponse: ConfigResponse = {
            action: "error",
            error: "Failed to process worker message",
            path: undefined,
            config: {
                version: "1.0.0",
                photoList: [],
                lastModified: 0,
            },
        };
        port?.postMessage(JSON.stringify(errorResponse));
    }
});
