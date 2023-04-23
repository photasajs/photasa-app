import { Glob } from "glob";
import path from "path";
import { removeFromPhotoList, addToPhotasaConfig } from "./config-storage";
import type { PhotasaConfigResult } from "../preload/types";
import { Observable, Subscriber, from, mergeMap } from "rxjs";
import type { Logger } from "log4js";

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

export function addConfig(result, postMessage: (msg: string) => void, logger: Logger): void {
    addToPhotasaConfig(result, postMessage, logger);
}

const BUFFER_SIZE = 30;
const queue: string[] = [];

export function queryConfig(
    result: { paths: string[] },
    postMessage: (msg: string) => void,
    logger: Logger,
): void {
    from(result.paths)
        .pipe(mergeMap((target: string) => globPhotasaConfigFromFolders(target)))
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
    request: { queueId: number; paths: string[] },
    postMessage: (msg: string) => void,
    logger: Logger,
): void {
    from(request.paths)
        .pipe(mergeMap((target: string) => removeFromPhotoList(target)))
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
