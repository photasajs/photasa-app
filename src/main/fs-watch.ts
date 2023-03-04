import chokidar, { type FSWatcher } from "chokidar";
import type { IpcMain, IpcMainEvent, BrowserWindow } from "electron";
import type { Logger } from "log4js";

let FileWatherHandler: FSWatcher | undefined;
export function initFileWatcher(ipc: IpcMain, mainWindow: BrowserWindow, logger: Logger): void {
    ipc.handle("picasa:stop-file-watch", () => {
        logger.info("Stop watching files......");
        FileWatherHandler?.close();
    });

    ipc.on("picasa:start-file-watch", (_event: IpcMainEvent, args) => {
        logger.info("Start watching files: ", args.paths);
        FileWatherHandler = chokidar.watch(args.paths, args.options);
        FileWatherHandler.on("add", (path) => {
            mainWindow?.webContents.send("picasa:file-add", { isFile: true, path });
        })
            .on("addDir", (path) => {
                mainWindow?.webContents.send("picasa:file-add", { isFile: false, path });
            })
            .on("change", (path) => {
                mainWindow?.webContents.send("picasa:file-change", { isFile: true, path });
            })
            .on("unlink", (path) => {
                mainWindow?.webContents.send("picasa:file-unlink", { isFile: true, path });
            })
            .on("unlinkDir", (path) => {
                mainWindow?.webContents.send("picasa:file-unlink", { isFile: false, path });
            })
            .on("error", (error) => {
                mainWindow?.webContents.send("picasa:file-error", { error });
            })
            .on("ready", () => {
                mainWindow?.webContents.send("picasa:file-ready", {});
            })
            .on("raw", (event, path, details) => {
                mainWindow?.webContents.send("picasa:file-raw", { event, path, details });
            });
    });
}
