import { app, shell, BrowserWindow, ipcMain, dialog, screen, protocol } from "electron";
import path from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import isDev from "electron-is-dev";
import klawSync from "klaw-sync";
import fs from "fs";
import { readFile } from "fs/promises";
import { loggers } from "@common/logger";
import { isMac } from "./platform";
import * as Sentry from "@sentry/electron/main";
import WatchService from "./watch/watch-service";
import icon from "../../resources/icon.png?asset";
import ThumbnailService from "./thumbnail/thumbnail-service";
import ConfigService from "./config/config-service";
import ScanService from "./scan/scan-service";
import WindowService from "./window/window-service";
import MenuService from "./menu/menu-service";
import ShellService from "./shell/shell-service";
import ImportService from "./import/import-service";
import LogViewerService from "./log-viewer/log-viewer-service";

const logger = loggers.main;
let mainWindow: BrowserWindow | undefined | null;
let watchService: WatchService | undefined;

// 初始化Sentry错误监控
if (!isDev) {
    Sentry.init({
        dsn: "https://6cde14d12de5882405e5837a80978152@o4510009078841344.ingest.us.sentry.io/4510009079889920",
        environment: process.env.NODE_ENV || "production",
        beforeSend(event) {
            // 过滤掉一些不重要的错误
            if (event.exception) {
                const error = event.exception.values?.[0];
                if (error?.type === "ChunkLoadError" || error?.type === "Loading chunk") {
                    return null; // 忽略chunk加载错误
                }
            }
            return event;
        },
    });
}

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

    // Check if folder has valid photasa.json
    ipcMain.handle("picasa:check-photasa-config", async (_, folderPath) => {
        try {
            const configPath = path.join(folderPath, ".photasa.json");
            if (!fs.existsSync(configPath)) {
                return { hasConfig: false, reason: "配置文件不存在" };
            }

            const configContent = await readFile(configPath, "utf8");
            const config = JSON.parse(configContent);

            if (
                !config.photoList ||
                !Array.isArray(config.photoList) ||
                config.photoList.length === 0
            ) {
                return { hasConfig: false, reason: "配置文件为空" };
            }

            return {
                hasConfig: true,
                photoCount: config.photoList.length,
                reason: "配置文件存在且有效",
            };
        } catch (error) {
            logger.error(`Error checking photasa config for ${folderPath}:`, error);
            // 如果是JSON解析错误，尝试修复配置文件
            if (error instanceof SyntaxError && error.message.includes("JSON")) {
                logger.warn(`JSON parse error for ${folderPath}, attempting to fix...`);
                try {
                    // 尝试读取文件内容并修复
                    const configPath = path.join(folderPath, ".photasa.json");
                    if (fs.existsSync(configPath)) {
                        const content = await readFile(configPath, "utf8");
                        logger.debug(`Corrupted config content: ${content.substring(0, 100)}...`);
                        // 创建默认配置
                        const defaultConfig = { photoList: [], version: "1.0.0" };
                        await fs.promises.writeFile(
                            configPath,
                            JSON.stringify(defaultConfig, null, 2),
                            "utf8",
                        );
                        logger.info(`Fixed corrupted config file: ${configPath}`);
                    }
                } catch (fixError) {
                    logger.error(`Failed to fix config file: ${folderPath}`, fixError);
                }
            }
            return { hasConfig: false, reason: "配置文件读取失败" };
        }
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

    // Setup Log Viewer Service (create early so other services can register workers)
    const logViewerService = new LogViewerService(ipcMain, mainWindow);
    // Setup Thumbnail Service
    new ThumbnailService(ipcMain, mainWindow, app, logViewerService);
    // Setup Config Service
    new ConfigService(ipcMain, mainWindow);
    // Setup Log Viewer Service (create early so other services can register workers)
    const logViewerService = new LogViewerService(ipcMain, mainWindow);
    // Setup Scan Service
    new ScanService(ipcMain, mainWindow, app, logViewerService);
    // Setup File Watch Service
    watchService = new WatchService(ipcMain, mainWindow);
    // Setup Window Service
    new WindowService(ipcMain, mainWindow, app);
    // 在主窗口创建后初始化菜单服务
    new MenuService(ipcMain, mainWindow);
    // 创建 shell 服务
    new ShellService(ipcMain, mainWindow);
    // Setup Import Service
    new ImportService(ipcMain, mainWindow);
}

/**
 * 当 Electron 完成初始化并准备好创建浏览器窗口时，将调用此方法。
 * 一些 API 只能在事件发生后使用。
 */
// 添加全局错误处理
process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
    if (!isDev) {
        Sentry.captureException(error);
    }
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    if (!isDev) {
        Sentry.captureException(new Error(`Unhandled Rejection: ${reason}`));
    }
});

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
