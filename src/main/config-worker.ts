import { parentPort } from "worker_threads";
import log4js from "log4js";
import { Glob } from "glob";
import path from "path";
import { removeFromPhotoList, addToPhotasaConfig } from "./config-storage";
import type { PhotasaConfigResult } from "../preload/types";
import { Observable, Subscriber, from, mergeMap } from "rxjs";

const DEV_MODE = process.env.NODE_ENV === "development";
const logger = log4js.getLogger("config-worker");
logger.level = DEV_MODE ? "debug" : "info";

const port = parentPort;
if (!port) {
    throw new Error("IllegalState");
}

function globPhotasaConfigFromFolders(folder: string): Observable<string> {
    const pattern = `**/*.photasa.json`;
    return new Observable<string>((subscriber: Subscriber<string>) => {
        const g3 = new Glob(pattern, {
            cwd: folder,
            dot: true,
        });
        g3.stream()
            .on("data", (photasa) => {
                subscriber.next(path.join(folder, photasa));
            })
            .on("end", () => {
                subscriber.complete();
            });
    });
}

const BUFFER_SIZE = 30;
const queue: string[] = [];

function queryConfig(paths: string[]): void {
    from(paths)
        .pipe(mergeMap((target: string) => globPhotasaConfigFromFolders(target)))
        .subscribe({
            next: (photasa) => {
                queue.push(photasa);

                if (queue.length > BUFFER_SIZE) {
                    logger.info("Photasaconfig is " + photasa);
                    port?.postMessage(
                        JSON.stringify({
                            action: "next",
                            paths: [...queue],
                        }),
                    );
                    queue.splice(0, queue.length);
                }
            },
            error: (err) => {
                port?.postMessage(
                    JSON.stringify({
                        action: "error",
                        err,
                    }),
                );
            },
            complete: () => {
                port?.postMessage(
                    JSON.stringify({
                        action: "complete",
                        path: [...queue],
                    }),
                );
                queue.splice(0, queue.length);
            },
        });
}

function removeConfig(request: { queueId: number; paths: string[] }): void {
    from(request.paths)
        .pipe(mergeMap((target: string) => removeFromPhotoList(target)))
        .subscribe({
            next: (result: PhotasaConfigResult) => {
                logger.info(`Save ${result.path} to photasa config`);
                port?.postMessage(
                    JSON.stringify({
                        action: "next",
                        queueId: request.queueId,
                        from: "remove",
                        ...result,
                    }),
                );
            },
            error: (err) => {
                port?.postMessage(
                    JSON.stringify({
                        action: "error",
                        queueId: request.queueId,
                        from: "remove",
                        err,
                    }),
                );
            },
            complete: () => {
                port?.postMessage(
                    JSON.stringify({
                        queueId: request.queueId,
                        action: "complete",
                        from: "remove",
                    }),
                );
            },
        });
}

port.on("message", (message) => {
    if (port) {
        const result = JSON.parse(message);
        switch (result.action) {
            case "query":
                queryConfig(result.paths);
                return;
            case "add":
                addToPhotasaConfig(
                    result,
                    (message) => {
                        port.postMessage(message);
                    },
                    logger,
                );
                return;
            case "remove":
                removeConfig(result);
                return;
            default:
                throw new Error("IllegalAction");
        }
    }
});
