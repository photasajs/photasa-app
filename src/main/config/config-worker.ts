import { parentPort } from "worker_threads";
import { queryConfig, addConfig, removeConfig } from "./config-handler";
import { WorkerError, handleError } from "@common/error-handler";
import type { ConfigRequest, ConfigResponse, ConfigHandlers } from "@common/config-types";
import { loggers } from "@common/logger";

const port = parentPort;
if (!port) {
    throw new WorkerError("Worker port is not available");
}

const logger = loggers.config;

const handler: ConfigHandlers = {
    query: queryConfig,
    add: addConfig,
    remove: removeConfig,
};

port.on("message", (message: string) => {
    try {
        const result = JSON.parse(message) as ConfigRequest;
        const action = result.action;

        if (!handler[action]) {
            throw new WorkerError(`Unknown action: ${action}`);
        }

        handler[action]?.call(
            this,
            result,
            (message: string) => {
                port?.postMessage(message);
            },
            logger,
        );
    } catch (error) {
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
