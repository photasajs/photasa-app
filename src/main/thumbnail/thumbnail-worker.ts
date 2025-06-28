import { parentPort } from "worker_threads";
import { createThumbnail, removeThumbnail } from "./thumbnail-handler";
import { loggers } from "@common/logger";

const logger = loggers.worker;

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
