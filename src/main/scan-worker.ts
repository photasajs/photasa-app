import { parentPort } from "worker_threads";
import log4js from "log4js";

import { walkthroughPhotos } from "./scan-photos";
import { ScanAction } from "../preload/types";

const DEV_MODE = process.env.NODE_ENV === "development";
const logger = log4js.getLogger("main");
logger.level = DEV_MODE ? "debug" : "info";

const port = parentPort;
if (!port) {
    throw new Error("IllegalState");
}

export function scanPhotos(scan: ScanAction): void {
    walkthroughPhotos(scan).subscribe({
        next: (action) => {
            port?.postMessage(
                JSON.stringify({
                    type: "next",
                    action,
                }),
            );
        },
        error: (error) => {
            logger.error(error);
            port?.postMessage(
                JSON.stringify({
                    type: "error",
                    error,
                }),
            );
        },
        complete: () => {
            port?.postMessage(
                JSON.stringify({
                    type: "complete",
                    action: {
                        path: scan.path,
                    },
                }),
            );
        },
    });
}

port.on("message", (message) => {
    const result = JSON.parse(message);
    switch (result.action) {
        case "scan":
            scanPhotos(result.scan);
            return;
        default:
            throw new Error("IllegalAction");
    }
});
