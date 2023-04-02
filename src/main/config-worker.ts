import { parentPort } from "worker_threads";
import type { Logger } from "log4js";
import log4js from "log4js";
import { mergeMap, from, Observable, Subscriber } from "rxjs";
import { Glob } from "glob";
import path from "path";

const DEV_MODE = process.env.NODE_ENV === "development";
const logger = log4js.getLogger("main");
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

function queryConfig(paths: string[], logger: Logger): void {
    from(paths)
        .pipe(mergeMap((target: string) => globPhotasaConfigFromFolders(target)))
        .subscribe({
            next: (photasa) => {
                logger.info("Photasaconfig is " + photasa);
                queue.push(photasa);

                if (queue.length > BUFFER_SIZE) {
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

port.on("message", (message) => {
    const result = JSON.parse(message);
    switch (result.action) {
        case "load":
            queryConfig(result.paths, logger);
            return;
        default:
            throw new Error("IllegalAction");
    }
});
