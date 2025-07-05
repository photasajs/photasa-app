import { app, shell, BrowserWindow, ipcMain, dialog, screen, protocol } from "electron";

import path from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import WatchService from "./watch/watch-service";
import { createMenu } from "./menu";
import icon from "../../resources/icon.png?asset";
import Bugsnag from "@bugsnag/electron";
import isDev from "electron-is-dev";
import klawSync from "klaw-sync";
import ThumbnailService from "./thumbnail/thumbnail-service";
import ConfigService from "./config/config-service";
import ScanService from "./scan/scan-service";
import fs from "fs";
import { loggers } from "@common/logger";
import { isMac } from "./platform";
import WindowService from "./window/window-service";

Bugsnag.start({
    apiKey: "905f9713071b76d7cd04cb3b19e4c730",
});

const logger = loggers.main;
let mainWindow: BrowserWindow | undefined | null;
let watchService: WatchService | undefined;

function createWindow(): void {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    // 创建窗口
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
        // 分平台配置
        ...(isMac() ? { titleBarStyle: "hiddenInset" } : { frame: false }),
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

    // 选择目录
    ipcMain.on("picasa:choose-directory", () => {
        if (mainWindow) {
            // 打开选择目录对话框
            dialog
                .showOpenDialog(mainWindow, {
                    properties: ["openDirectory"],
                })
                .then(({ filePaths }) => {
                    // 发送选择目录事件
                    mainWindow?.webContents.send("picasa:selected-directory", { filePaths });
                })
                .catch((err) => {
                    // 错误处理
                    console.log(err);
                });
        }
    });

    // Get system directory
    ipcMain.handle("picasa:get-directory", async (_, args) => {
        return app.getPath(args.name);
    });

    // Open in finder
    ipcMain.on("picasa:open-in-finder", (_, args) => {
        logger.info("picasa:open-in-finder", { path: args.path });
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
    // Setup Config Service
    new ConfigService(ipcMain, mainWindow);
    // Setup Scan Service
    new ScanService(ipcMain, mainWindow);
    // Setup File Watch Service
    watchService = new WatchService(ipcMain, mainWindow);
    // Setup Window Service
    new WindowService(ipcMain, mainWindow);
}

/**
 * 当 Electron 完成初始化并准备好创建浏览器窗口时，将调用此方法。
 * 一些 API 只能在事件发生后使用。
 */
app.whenReady().then(() => {
    // 设置应用用户模型 ID
    electronApp.setAppUserModelId("com.photasa.app");

    // 设置 dock 图标
    if (process.platform === "darwin" && app.dock) {
        app.dock.setIcon(icon);
    }

    // 默认打开或关闭 DevTools 按 F12 开发
    // 生产环境忽略 CommandOrControl + R
    // 参考 https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on("browser-window-created", (_, window) => {
        optimizer.watchWindowShortcuts(window);
    });

    // 创建窗口
    createWindow();

    // 当 dock 图标被点击且没有其他窗口打开时，重新创建一个窗口
    app.on("activate", function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // 注册 file 协议
    // @see https://github.com/electron/electron/issues/23757#issuecomment-640146333
    protocol.registerFileProtocol("file", (request, callback) => {
        const pathname = decodeURIComponent(request.url.replace("file:///", ""));
        callback(pathname);
    });
});

/**
 * 当所有窗口关闭时退出，除了 macOS。
 * 在 macOS 上，应用程序和菜单栏通常会保持活动状态，直到用户显式退出。
 */
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
    watchService?.close();
    mainWindow = null;
});

/**
 * 在文件中可以包含应用程序的特定主进程代码。
 * 也可以将它们放在单独的文件中并在这里 require。
 */
