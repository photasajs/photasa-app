import { parentPort } from "worker_threads";
import { createThumbnail, removeThumbnail } from "./thumbnail-handler";
import log4js from "log4js";

const DEV_MODE = process.env.NODE_ENV === "development";
const logger = log4js.getLogger("main");
logger.level = DEV_MODE ? "debug" : "info";

const port = parentPort;
if (!port) {
    throw new Error("IllegalState");
}

port.on("message", (message) => {
    const result = JSON.parse(message);
    switch (result.action) {
        case "create":
            createThumbnail(result.arg, logger).then(() => {
                port.postMessage(message);
            });
            return;
        case "remove":
            removeThumbnail(result.arg, logger).then(() => {
                port.postMessage(message);
            });
            return;
        default:
            throw new Error("IllegalAction");
    }
});
