import { Glob } from "glob";
import path from "path";
import { removeFromPhotoList, addToPhotasaConfig } from "./config-storage";
import type { PhotasaConfigResult } from "@common/types";
import { Observable, Subscriber, from, mergeMap } from "rxjs";
import type { Logger } from "log4js";
import { FileSystemError, ConfigError, handleError } from "@common/error-handler";
import type { WorkerMessage } from "@common/worker-types";

function globPhotasaConfigFromFolders(folder: string, logger: Logger): Observable<string> {
    const pattern = `**/*.photasa.json`;
    return new Observable<string>((subscriber: Subscriber<string>) => {
        try {
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
                })
                .on("error", (error) => {
                    handleError(
                        new FileSystemError(`Failed to scan folder: ${folder}`, { error }),
                        logger,
                        "globPhotasaConfigFromFolders",
                    );
                    subscriber.error(error);
                });
        } catch (error) {
            handleError(
                new FileSystemError(`Failed to initialize folder scan: ${folder}`, { error }),
                logger,
                "globPhotasaConfigFromFolders",
            );
            subscriber.error(error);
        }
    });
}

export function addConfig(
    result: WorkerMessage,
    postMessage: (msg: string) => void,
    logger: Logger,
): void {
    try {
        if (!result.paths) {
            throw new ConfigError("No paths provided for add config");
        }
        addToPhotasaConfig(
            { queueId: result.queueId ?? 0, paths: result.paths },
            postMessage,
            logger,
        );
    } catch (error) {
        handleError(new ConfigError("Failed to add config", { error }), logger, "addConfig");
        postMessage(
            JSON.stringify({
                action: "error",
                error: "Failed to add config",
            }),
        );
    }
}

const BUFFER_SIZE = 30;
const queue: string[] = [];

export function queryConfig(
    result: WorkerMessage,
    postMessage: (msg: string) => void,
    logger: Logger,
): void {
    if (!result.paths) {
        throw new ConfigError("No paths provided for query config");
    }
    from(result.paths)
        .pipe(mergeMap((target: string) => globPhotasaConfigFromFolders(target, logger)))
        .subscribe({
            next: (photasa) => {
                queue.push(photasa);

                if (queue.length > BUFFER_SIZE) {
                    logger.info("Photasaconfig is " + photasa);
                    postMessage(
                        JSON.stringify({
                            action: "next",
                            paths: [...queue],
                        }),
                    );
                    queue.splice(0, queue.length);
                }
            },
            error: (err) => {
                handleError(
                    new ConfigError("Error querying config", { error: err }),
                    logger,
                    "queryConfig",
                );
                postMessage(
                    JSON.stringify({
                        action: "error",
                        err,
                    }),
                );
            },
            complete: () => {
                postMessage(
                    JSON.stringify({
                        action: "complete",
                        path: [...queue],
                    }),
                );
                queue.splice(0, queue.length);
            },
        });
}

export function removeConfig(
    request: WorkerMessage,
    postMessage: (msg: string) => void,
    logger: Logger,
): void {
    if (!request.paths) {
        throw new ConfigError("No paths provided for remove config");
    }
    if (typeof request.queueId !== "number") {
        throw new ConfigError("No queueId provided for remove config");
    }
    from(request.paths)
        .pipe(mergeMap((target: string) => removeFromPhotoList(target, logger)))
        .subscribe({
            next: (result: PhotasaConfigResult) => {
                logger.info(`Save ${result.path} to photasa config`);
                postMessage(
                    JSON.stringify({
                        action: "next",
                        queueId: request.queueId,
                        from: "remove",
                        ...result,
                    }),
                );
            },
            error: (err) => {
                handleError(
                    new ConfigError("Error removing config", { error: err }),
                    logger,
                    "removeConfig",
                );
                postMessage(
                    JSON.stringify({
                        action: "error",
                        queueId: request.queueId,
                        from: "remove",
                        err,
                    }),
                );
            },
            complete: () => {
                postMessage(
                    JSON.stringify({
                        queueId: request.queueId,
                        action: "complete",
                        from: "remove",
                    }),
                );
            },
        });
}
