import { loggers } from "@common/logger";
import type { BrowserWindow, IpcMain } from "electron";
import { shell } from "electron";

export default class ShellService {
    ipc: IpcMain;
    mainWindow: BrowserWindow;
    logger = loggers.shell;

    constructor(ipcMain: IpcMain, mainWindow: BrowserWindow) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;

        this.init();
    }

    private init(): void {
        // Open in finder
        this.ipc.on("picasa:open-in-finder", (_, args) => {
            this.logger.info("picasa:open-in-finder", { path: args.path });
            shell.showItemInFolder(args.path);
        });

        // Open external
        this.ipc.handle("shell:openExternal", (_, url: string) => {
            shell.openExternal(url);
        });
    }
}
