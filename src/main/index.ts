import { app, shell, BrowserWindow, ipcMain, dialog, screen, protocol } from "electron";

import path from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import log4js from "log4js";
import { initFileWatcher } from "./fs-watch";
import { createMenu } from "./menu";
import icon from "../../resources/icon.png?asset";
import Bugsnag from "@bugsnag/electron";
import isDev from "electron-is-dev";
import klawSync from "klaw-sync";
import ThumbnailService from "./thumbnail-service";
import ConfigService from "./config/config-service";
import ScanService from "./scan-service";
import { closeFileWatcher } from "./fs-watch";
import fs from "fs";

Bugsnag.start({
    apiKey: "905f9713071b76d7cd04cb3b19e4c730",
});

const DEV_MODE = process.env.NODE_ENV === "development";
const logger = log4js.getLogger("main");
logger.level = DEV_MODE ? "debug" : "info";
let mainWindow: BrowserWindow | undefined | null;

function createWindow(): void {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width,
        height,
        show: false,
        title: "Photasa",
        autoHideMenuBar: true,
        icon: icon, // Set icon for all platforms
        webPreferences: {
            preload: path.join(__dirname, "../preload/index.js"),
            sandbox: false,
            webSecurity: !isDev, // enable to load local source
            nodeIntegration: false,
            contextIsolation: true,
        },
        titleBarStyle: "hiddenInset",
    });

    // Handle page refreshes
    mainWindow.webContents.on("did-finish-load", () => {
        // Ensure preload script is loaded
        mainWindow?.webContents.executeJavaScript(`
            if (!window.api) {
                window.location.reload();
            }
        `);
    });

    createMenu();

    mainWindow.on("ready-to-show", () => {
        mainWindow?.show();

        if (!DEV_MODE) {
            mainWindow?.webContents.openDevTools();
        }
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: "deny" };
    });

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
        mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    } else {
        mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    }

    ipcMain.on("picasa:choose-directory", () => {
        if (mainWindow) {
            dialog

                .showOpenDialog(mainWindow, {
                    properties: ["openDirectory"],
                })
                .then(({ filePaths }) => {
                    mainWindow?.webContents.send("picasa:selected-directory", { filePaths });
                })
                .catch((err) => {
                    console.log(err);
                });
        }
    });

    ipcMain.handle("picasa:get-directory", async (_, args) => {
        return app.getPath(args.name);
    });

    ipcMain.on("picasa:open-in-finder", (_, args) => {
        shell.showItemInFolder(args.path);
    });

    ipcMain.handle("picasa:sub-folders", async (_, args) => {
        try {
            const filterFn = (item: { path: string }): boolean => {
                const basename = path.basename(item.path as string);
                return basename === "." || basename[0] !== ".";
            };

            // Check if directory exists
            if (!fs.existsSync(args.parent)) {
                const error = new Error(`Directory does not exist: ${args.parent}`);
                logger.warn(error.message);
                throw error; // Propagate error to renderer
            }

            const folders = klawSync(args.parent, {
                nofile: true,
                depthLimit: 0,
                filter: filterFn,
                errorCallback: (err) => {
                    logger.error(`Error scanning directory ${args.parent}:`, err);
                },
            });

            return folders.map((item) => item.path);
        } catch (error) {
            logger.error(`Error in picasa:sub-folders handler:`, error);
            // Rethrow the error to be handled by the renderer
            throw error;
        }
    });

    // Setup Thumbnail Service
    new ThumbnailService(ipcMain);
    new ConfigService(ipcMain, mainWindow);
    new ScanService(ipcMain, mainWindow);

    // Setup File Watch Service
    initFileWatcher(ipcMain, mainWindow, logger);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId("com.electron");

    // Set dock icon for macOS
    if (process.platform === "darwin" && app.dock) {
        app.dock.setIcon(icon);
    }

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on("browser-window-created", (_, window) => {
        optimizer.watchWindowShortcuts(window);
    });

    createWindow();

    app.on("activate", function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
    // @see https://github.com/electron/electron/issues/23757#issuecomment-640146333
    protocol.registerFileProtocol("file", (request, callback) => {
        const pathname = decodeURIComponent(request.url.replace("file:///", ""));
        callback(pathname);
    });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
    closeFileWatcher();
    mainWindow = null;
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
