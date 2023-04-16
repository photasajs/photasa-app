import chokidar, { type FSWatcher } from "chokidar";
import type { IpcMain, IpcMainEvent, BrowserWindow } from "electron";
import type { Logger } from "log4js";

let FileWatcherHandler: FSWatcher | undefined | null;
export function initFileWatcher(ipc: IpcMain, mainWindow: BrowserWindow, logger: Logger): void {
    ipc.handle("picasa:stop-file-watch", () => {
        logger.info("Stop watching files......");
        FileWatcherHandler?.close();
    });

    ipc.on("picasa:start-file-watch", (_event: IpcMainEvent, args) => {
        // If handler is opened, close it.
        if (FileWatcherHandler) {
            FileWatcherHandler?.close();
            FileWatcherHandler = undefined;
        }
        logger.info("Start watching files: ", args.paths);
        FileWatcherHandler = chokidar.watch(args.paths, args.options);
        FileWatcherHandler.on("add", (path) => {
            logger.info(`Add file ${path}`);
            mainWindow?.webContents.send("picasa:file-add", { isFile: true, path });
        })
            .on("addDir", (path) => {
                logger.info(`Add folder ${path}`);
                mainWindow?.webContents.send("picasa:file-add", { isFile: false, path });
            })
            .on("change", (path) => {
                logger.info(`Change file ${path}`);
                mainWindow?.webContents.send("picasa:file-change", { isFile: true, path });
            })
            .on("unlink", (path) => {
                logger.info(`Delete file ${path}`);
                mainWindow?.webContents.send("picasa:file-unlink", { isFile: true, path });
            })
            .on("unlinkDir", (path) => {
                logger.info(`Delete folder ${path}`);
                mainWindow?.webContents.send("picasa:file-unlink", { isFile: false, path });
            })
            .on("error", (error) => {
                mainWindow?.webContents.send("picasa:file-error", { error });
            })
            .on("ready", () => {
                mainWindow?.webContents.send("picasa:file-ready", {});
            });
    });
}
