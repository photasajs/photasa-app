import { parentPort } from "worker_threads";
import log4js from "log4js";
import type { ScanAction } from "../preload/types";
import { scanPhotos } from "./scan-photos";

const DEV_MODE = process.env.NODE_ENV === "development";
const logger = log4js.getLogger("scan-worker");
logger.level = DEV_MODE ? "debug" : "info";

const port = parentPort;
if (!port) {
    throw new Error("IllegalState");
}
function postMessage(message): void {
    logger.debug("Worker posting message:", message);
    port?.postMessage(JSON.stringify(message));
}

export function execute(requestId: string, scan: ScanAction): void {
    logger.debug("Worker executing scan:", { requestId, scan });
    try {
        scanPhotos(scan, logger).subscribe({
            next: (action) => {
                logger.debug("Scan progress:", action);
            },
            error: (error) => {
                logger.error("Scan failed:", error);
                postMessage({
                    type: "error",
                    requestId,
                    error,
                });
            },
            complete: () => {
                logger.debug("Scan completed successfully");
                postMessage({
                    type: "complete",
                    requestId,
                    action: {
                        path: scan.path,
                    },
                });
            },
        });
    } catch (error) {
        logger.error("Error in execute:", error);
        postMessage({
            type: "error",
            requestId,
            error,
        });
    }
}

port.on("message", (message) => {
    let parsedResult;
    try {
        parsedResult = JSON.parse(message);
        logger.debug("Worker received message:", parsedResult);
        switch (parsedResult.action) {
            case "scan":
                logger.debug("Starting scan for request:", parsedResult.requestId);
                execute(parsedResult.requestId, parsedResult.scan);
                return;
            default:
                logger.error("Unknown action:", parsedResult.action);
                throw new Error("IllegalAction");
        }
    } catch (error) {
        logger.error("Error processing message:", error);
        postMessage({
            type: "error",
            requestId: parsedResult?.requestId,
            error,
        });
    }
});
