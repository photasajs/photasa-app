import { loggers } from "@common/logger";
import { WatchServiceEvent, type WatchConfig } from "@common/watch-types";
import chokidar, { type FSWatcher } from "chokidar";
import type { IpcMain, IpcMainEvent, BrowserWindow } from "electron";

export default class WatchService {
    ipc: IpcMain;
    mainWindow: BrowserWindow;
    FileWatcherHandler: FSWatcher | undefined;
    logger = loggers.watch;

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;

        this.init();
    }

    private init(): void {
        // Stop watching files
        this.ipc.handle("picasa:stop-file-watch", () => {
            this.logger.info("Stop watching files......");
            this.FileWatcherHandler?.close();
        });

        // Start watching files
        this.ipc.on(WatchServiceEvent.start, (_event: IpcMainEvent, args: WatchConfig) => {
            this.startWatching(args);
        });
    }

    private startWatching(args: WatchConfig): void {
        this.logger.info("Start watching files: ", args.paths);
        // Close the previous watcher
        this.FileWatcherHandler?.close();
        // Create a new watcher
        this.FileWatcherHandler = chokidar.watch(args.paths, args.options);

        // Watch the files
        this.FileWatcherHandler.on("add", (path) => {
            this.logger.info(`Add file ${path}`);
            this.mainWindow?.webContents.send(WatchServiceEvent.add, { isFile: true, path });
        })
            .on("addDir", (path) => {
                this.logger.info(`Add folder ${path}`);
                this.mainWindow?.webContents.send(WatchServiceEvent.add, { isFile: false, path });
            })
            .on("change", (path) => {
                this.logger.info(`Change file ${path}`);
                this.mainWindow?.webContents.send(WatchServiceEvent.change, { isFile: true, path });
            })
            .on("unlink", (path) => {
                this.logger.info(`Delete file ${path}`);
                this.mainWindow?.webContents.send(WatchServiceEvent.unlink, { isFile: true, path });
            })
            .on("unlinkDir", (path) => {
                this.logger.info(`Delete folder ${path}`);
                this.mainWindow?.webContents.send(WatchServiceEvent.unlink, {
                    isFile: false,
                    path,
                });
            })
            .on("error", (error) => {
                this.mainWindow?.webContents.send(WatchServiceEvent.error, { error });
            })
            .on("ready", () => {
                this.mainWindow?.webContents.send(WatchServiceEvent.ready, {});
            });
    }

    close(): void {
        this.ipc.removeAllListeners(WatchServiceEvent.start);
        this.ipc.removeAllListeners(WatchServiceEvent.stop);
        this.FileWatcherHandler?.close();
        this.FileWatcherHandler = undefined;
    }
}
