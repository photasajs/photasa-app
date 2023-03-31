import { parentPort } from "worker_threads";
import { createThumbnail, removeThumbnail } from "./thumbnail";
import log4js from "log4js";

const DEV_MODE = process.env.NODE_ENV === "development";
const logger = log4js.getLogger("main");
logger.level = DEV_MODE ? "debug" : "info";

const port = parentPort;
if (!port) {
    throw new Error("IllegalState");
}
/*
function queryConfig(args) {
    from(args.paths)
        .pipe(mergeMap((target) => globPhotasaConfigFromFolders(target)))
        .subscribe({
            next: (photasa) => {
                mainWindow?.webContents.send("picasa:photasa-config", {
                    action: "next",
                    paths: [photasa],
                });
            },
            error: (err) => {
                mainWindow?.webContents.send("picasa:photasa-config", { action: "error", err });
            },
            complete: () => {
                mainWindow?.webContents.send("picasa:photasa-config", { action: "complete" });
            },
        });
}
*/

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
