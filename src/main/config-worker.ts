import { parentPort } from "worker_threads";
import { queryConfig, addConfig, removeConfig } from "./config-handler";
import log4js from "log4js";
const DEV_MODE = process.env.NODE_ENV === "development";
const logger = log4js.getLogger("config-worker");
logger.level = DEV_MODE ? "debug" : "info";

const port = parentPort;
if (!port) {
    throw new Error("IllegalState");
}

const handler = {
    query: queryConfig,
    add: addConfig,
    remove: removeConfig,
};

port.on("message", (message) => {
    const result = JSON.parse(message);
    handler[result.action]?.call(
        this,
        result,
        (message) => {
            port?.postMessage(message);
        },
        logger,
    );
});
