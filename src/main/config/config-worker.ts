import { parentPort } from "worker_threads";
import { queryConfig, addConfig, removeConfig } from "./config-handler";
import log4js from "log4js";
import { WorkerError, handleError } from "@common/error-handler";
import type { WorkerMessage, WorkerResponse, WorkerHandlers } from "@common/worker-types";

const DEV_MODE = process.env.NODE_ENV === "development";
const logger = log4js.getLogger("config-worker");
logger.level = DEV_MODE ? "debug" : "info";

const port = parentPort;
if (!port) {
    throw new WorkerError("Worker port is not available");
}

const handler: WorkerHandlers = {
    query: queryConfig,
    add: addConfig,
    remove: removeConfig,
};

port.on("message", (message: string) => {
    try {
        const result = JSON.parse(message) as WorkerMessage;
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
        const errorResponse: WorkerResponse = {
            action: "error",
            error: "Failed to process worker message",
        };
        port?.postMessage(JSON.stringify(errorResponse));
    }
});
