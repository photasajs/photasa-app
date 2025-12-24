import { app, shell, BrowserWindow, ipcMain, screen, protocol, Menu } from "electron";
import path from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import isDev from "electron-is-dev";
import { loggers } from "@common/logger";
import { isMac } from "./platform";
import * as Sentry from "@sentry/electron/main";
import icon from "../../resources/icon.png?asset";

import { SplashWindow } from "./splash/splash-window";
import { StartupOptimizerV2 } from "./tianting/startup-optimizer-v2";
import { SingleInstanceManager } from "./single-instance-manager";
import { startupMonitor } from "./performance/startup-performance-monitor";
import { validateConfig } from "./tianting/config/service-config-validator";
import { configureFFmpeg } from "../engines/maliang/brushes/video/ffmpeg-config";

/**
 * 导入天庭非神位服务，确保@Service装饰器被执行
 */
import "./tianting";

/**
 * 导入天庭神位服务，确保@Service装饰器被执行
 */
import "./deity";

/**
 * 导入太乙适配器，确保@Adapter装饰器被执行
 */
import "@engines/adapters";

const logger = loggers.main;

// 立即初始化 Sentry（在模块加载时）
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
    logger.info("Sentry initialized at module load");
}

// 定义全局变量
let mainWindow: BrowserWindow | undefined | null;
let splashWindow: SplashWindow | undefined;
let startupOptimizer: StartupOptimizerV2 | undefined;
const singleInstanceManager = new SingleInstanceManager({
    appName: "Photasa",
    focusOnSecondInstance: true,
    restoreMinimizedWindow: true,
    createWindowOnMacOS: true,
});

/**
 * 创建主窗口
 */
async function createWindow(): Promise<void> {
    const startTime = Date.now();
    logger.info("Starting optimized application startup");
    startupMonitor.mark("windowCreated");

    // 配置 FFmpeg 并设置环境变量
    try {
        const ffmpegConfig = configureFFmpeg();
        process.env.FFMPEG_PATH = ffmpegConfig.ffmpegPath;
        process.env.FFPROBE_PATH = ffmpegConfig.ffprobePath;
        logger.info("FFmpeg configuration set as environment variables");
    } catch (error) {
        logger.error("Failed to configure FFmpeg:", error);
        // 继续启动，但记录错误
    }

    // 验证服务配置
    if (!validateConfig()) {
        logger.error("Service configuration is invalid, startup may fail");
        // 继续启动，但记录警告
    }

    try {
        // 1. 立即显示闪屏
        try {
            splashWindow = new SplashWindow();
            splashWindow.show();
            startupMonitor.mark("splashShown");
            splashWindow?.updateStatus("启动应用程序...");
        } catch (splashError) {
            logger.error("Failed to create splash window:", splashError);
            // 如果闪屏创建失败，继续启动但不显示闪屏
            splashWindow = undefined;
        }

        // 2. IPC 处理器现在由服务系统自动管理
        startupMonitor.mark("ipcHandlersRegistered");

        // 3. 创建主窗口（但不显示）
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        splashWindow?.updateStatus("创建主窗口...");

        mainWindow = new BrowserWindow({
            width,
            height,
            show: false,
            title: "Photasa",
            autoHideMenuBar: true,
            icon: icon,
            webPreferences: {
                preload: path.join(__dirname, "../preload/index.js"),
                sandbox: false,
                webSecurity: !isDev,
                nodeIntegration: false,
                contextIsolation: true,
            },
            ...(isMac() ? { titleBarStyle: "hiddenInset" } : { frame: false }),
        });

        // 4. 设置窗口事件处理器
        setupWindowHandlers();

        // 5. 初始化启动优化器
        splashWindow?.updateStatus("初始化核心服务...");
        startupOptimizer = new StartupOptimizerV2(mainWindow, app, ipcMain);

        // 6. 只初始化关键服务（阻塞）
        await startupOptimizer.initializeServices();
        startupMonitor.mark("servicesInitialized");

        // 7. 开始加载渲染进程
        splashWindow?.updateStatus("加载用户界面...");
        await loadRenderer();
        startupMonitor.mark("rendererLoaded");

        splashWindow?.updateStatus("即将完成...");

        // 8. 渲染器加载完成后，使用淡出动画平滑过渡
        const totalTime = Date.now() - startTime;
        logger.info(`Optimized startup completed in ${totalTime}ms`);

        // IPC 处理器现在由服务系统自动管理，无需手动延迟注册

        // 使用淡出动画平滑关闭启动画面并显示主窗口
        logger.info("Starting splash fadeOut transition");

        if (splashWindow) {
            splashWindow.fadeOut(() => {
                logger.info("Splash fadeOut completed");
                splashWindow = undefined;
                startupMonitor.mark("splashHidden");

                if (mainWindow) {
                    logger.info("Showing main window");
                    mainWindow.show();
                    mainWindow.focus(); // 确保主窗口获得焦点
                    logger.info("Application startup finished, main window visible and focused");

                    // 报告性能指标
                    startupMonitor.report();
                } else {
                    logger.error("mainWindow is null when trying to show");
                }
            });
        } else {
            // 如果没有启动画面，直接显示主窗口
            logger.warn("splashWindow is null/undefined, showing main window directly");
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
                logger.info("Application startup finished, main window visible and focused");
                startupMonitor.mark("splashHidden");

                // 报告性能指标
                startupMonitor.report();
            } else {
                logger.error("mainWindow is null when trying to show");
            }
        }
    } catch (error) {
        logger.error("Optimized startup failed:", error);
        splashWindow?.updateStatus("启动失败");

        // 即使启动失败，也要尝试显示主窗口（可能渲染器已经加载成功）
        setTimeout(() => {
            if (splashWindow) {
                splashWindow.hide();
                splashWindow = undefined;
            }

            // 尝试显示主窗口，即使启动过程中有错误
            if (mainWindow && !mainWindow.isVisible()) {
                logger.info("Force showing main window after startup error");
                mainWindow.show();
            }
        }, 2000);

        // 不要抛出错误，让应用继续运行
        // throw error;
    }
}

function setupWindowHandlers(): void {
    if (!mainWindow) return;

    // Handle page refreshes
    mainWindow.webContents.on("did-finish-load", () => {
        mainWindow?.webContents.executeJavaScript(`
            if (!window.api) {
                window.location.reload();
            }
        `);
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: "deny" };
    });

    // 允许 DevTools 中的复制粘贴快捷键（仅在开发模式下）
    // 当 DevTools 打开时，临时添加 Edit 菜单以支持复制粘贴
    if (isDev) {
        let originalMenu: Menu | null = null;
        mainWindow.webContents.on("devtools-opened", () => {
            // 保存原始菜单
            originalMenu = Menu.getApplicationMenu();

            // 创建包含 Edit 菜单的临时菜单
            const editMenuTemplate: Electron.MenuItemConstructorOptions = {
                label: "Edit",
                submenu: [
                    { role: "undo", label: "Undo" },
                    { role: "redo", label: "Redo" },
                    { type: "separator" },
                    { role: "cut", label: "Cut" },
                    { role: "copy", label: "Copy" },
                    { role: "paste", label: "Paste" },
                    { type: "separator" },
                    { role: "selectAll", label: "Select All" },
                ],
            };

            // 如果有原始菜单，合并 Edit 菜单；否则创建新菜单
            const currentMenu = Menu.getApplicationMenu();
            if (currentMenu) {
                const template = currentMenu.items.map((item) => ({
                    label: item.label,
                    role: item.role,
                    submenu: item.submenu,
                })) as Electron.MenuItemConstructorOptions[];

                // 检查是否已有 Edit 菜单
                const hasEditMenu = template.some((item) => item.label === "Edit");
                if (!hasEditMenu) {
                    // 在第一个菜单后插入 Edit 菜单
                    template.splice(1, 0, editMenuTemplate);
                    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
                }
            } else {
                Menu.setApplicationMenu(Menu.buildFromTemplate([editMenuTemplate]));
            }
        });

        // 当 DevTools 关闭时，恢复原始菜单
        mainWindow.webContents.on("devtools-closed", () => {
            if (originalMenu) {
                Menu.setApplicationMenu(originalMenu);
                originalMenu = null;
            }
        });
    }
}

async function loadRenderer(): Promise<void> {
    if (!mainWindow) return;

    return new Promise((resolve) => {
        // 调整超时时间为 15 秒，更合理的超时时间
        const timeout = setTimeout(() => {
            logger.warn("Renderer load timeout after 15 seconds, continuing anyway");
            resolve(); // 继续流程而不是中断
        }, 15000);

        // 监听加载完成事件
        if (mainWindow) {
            mainWindow.webContents.once("did-finish-load", () => {
                clearTimeout(timeout);
                logger.info("Renderer loaded successfully");
                resolve();
            });

            // 监听加载失败事件
            mainWindow.webContents.once(
                "did-fail-load",
                (_, errorCode, errorDescription, validatedURL) => {
                    clearTimeout(timeout);
                    logger.warn(
                        `Renderer failed to load: ${errorDescription} (${errorCode}) - URL: ${validatedURL}, continuing anyway`,
                    );
                    resolve(); // 继续流程而不是中断
                },
            );
        }

        // Load renderer
        if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
            logger.debug(
                `Loading renderer from development server: ${process.env["ELECTRON_RENDERER_URL"]}`,
            );

            // 在开发环境下，如果渲染器URL不可用，fallback到文件加载
            if (mainWindow) {
                mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]).catch((urlError) => {
                    logger.warn(
                        `Failed to load from dev server, falling back to file: ${urlError.message}`,
                    );
                    const rendererPath = path.join(__dirname, "../renderer/index.html");
                    logger.debug(`Loading renderer from fallback file: ${rendererPath}`);
                    if (mainWindow) {
                        mainWindow.loadFile(rendererPath);
                    }
                });
            }
        } else {
            const rendererPath = path.join(__dirname, "../renderer/index.html");
            logger.debug(`Loading renderer from file: ${rendererPath}`);
            if (mainWindow) {
                mainWindow.loadFile(rendererPath);
            }
        }
    });
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

// 检查单实例锁
if (!singleInstanceManager.initialize()) {
    // 如果没有获得锁，应用会自动退出
    process.exit(0);
}

// 设置单实例事件处理器
(app as any).on("single-instance-window-recreate-needed", () => {
    logger.info("Recreating window on second instance request");
    if (!mainWindow) {
        createWindow().catch((error) => {
            logger.error("Failed to recreate window:", error);
        });
    }
});

(app as any).on("second-instance-files", (data: { files: string[]; workingDirectory: string }) => {
    logger.info("Second instance launched with files:", data.files);

    // 处理文件打开请求
    if (mainWindow && data.files.length > 0) {
        mainWindow.webContents.send("app:open-files", {
            files: data.files,
            workingDirectory: data.workingDirectory,
        });
    }
});

(app as any).on("second-instance-debug-mode", () => {
    logger.info("Second instance launched in debug mode");

    // 在调试模式下打开开发者工具
    if (mainWindow && isDev) {
        mainWindow.webContents.openDevTools();
    }
});

app.whenReady().then(async () => {
    startupMonitor.mark("appReady");

    // 如果没有获得锁，不应该到达这里，但为了安全起见
    if (!singleInstanceManager.hasInstanceLock()) {
        return;
    }

    // 设置应用用户模型 ID
    electronApp.setAppUserModelId("me.photasa.app");

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

    // 使用优化的创建窗口流程
    await createWindow();

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
app.on("window-all-closed", async () => {
    if (process.platform !== "darwin") {
        app.quit();
    }

    // 清理服务
    if (startupOptimizer) {
        try {
            await startupOptimizer.shutdownAllServices();
        } catch (error) {
            logger.error("Failed to shutdown services:", error);
        }
    }

    // 清理全局变量
    mainWindow = null;
    startupOptimizer = undefined;

    logger.info("Application windows closed, services cleaned up");
});

/**
 * 在文件中可以包含应用程序的特定主进程代码。
 * 也可以将它们放在单独的文件中并在这里 require。
 */
