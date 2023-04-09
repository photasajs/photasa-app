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
    port?.postMessage(JSON.stringify(message));
}

export function execute(requestId: string, scan: ScanAction): void {
    scanPhotos(scan, logger).subscribe({
        next: (action) => {
            /*
            postMessage({
                type: "next",
                requestId,
                action,
            });
            */
        },
        error: (error) => {
            logger.error(error);
            postMessage({
                type: "error",
                requestId,
                error,
            });
        },
        complete: () => {
            postMessage({
                type: "complete",
                requestId,
                action: {
                    path: scan.path,
                },
            });
        },
    });
}

port.on("message", (message) => {
    const result = JSON.parse(message);
    switch (result.action) {
        case "scan":
            execute(result.requestId, result.scan);
            return;
        default:
            throw new Error("IllegalAction");
    }
});
