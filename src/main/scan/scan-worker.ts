import { parentPort } from "worker_threads";
import type { ScanAction } from "@common/types";
import { scanPhotos } from "./scan-photos";
import { loggers } from "@common/logger";

const logger = loggers.worker;

const port = parentPort;
if (!port) {
    throw new Error("IllegalState");
}

/**
 * 发送消息
 * @param message - 消息
 */
function postMessage(message): void {
    logger.debug("Worker posting message:", message);
    port?.postMessage(message);
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
        parsedResult = message;
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
