import { parentPort } from "worker_threads";
import { queryConfig, addConfig, removeConfig } from "@photasa/config-core";
import { WorkerError, handleError } from "@photasa/common";
import type { ConfigRequest, ConfigResponse, ConfigHandlers } from "@photasa/common";
import { loggers } from "@photasa/common";
import {
    createWorkerLogViewerBridge,
    handleLogViewerStatusMessage,
} from "../workers/worker-log-viewer-bridge";

const port = parentPort;
if (!port) {
    // 在测试环境中可能没有parentPort，只在生产环境中抛出错误
    if (process.env.NODE_ENV !== "test") {
        throw new WorkerError("Worker port is not available");
    }
}

const logger = loggers.config;

const CONFIG_WORKER_THREAD_ID = "config-worker";

const configLogBridge = createWorkerLogViewerBridge({
    port,
    baseLogger: {
        debug: (m) => logger.debug(m),
        info: (m) => logger.info(m),
        warn: (m) => logger.warn(m),
        error: (m) => logger.error(m),
    },
    threadId: CONFIG_WORKER_THREAD_ID,
});
const { workerLog, createCategoryLogger } = configLogBridge;

const handler: ConfigHandlers = {
    query: queryConfig,
    add: addConfig,
    remove: removeConfig,
};

port?.on("message", (message: any) => {
    if (handleLogViewerStatusMessage(message, configLogBridge, CONFIG_WORKER_THREAD_ID)) {
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
            createCategoryLogger(CONFIG_WORKER_THREAD_ID) as any,
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
