import { BrowserWindow, nativeTheme } from "electron";
import path from "path";
import { loggers } from "@photasa/common";
import { is } from "@electron-toolkit/utils";

const logger = loggers.main;

export interface SplashScreenConfig {
    width: number;
    height: number;
    resizable: boolean;
    frame: boolean;
    alwaysOnTop: boolean;
    skipTaskbar: boolean;
    webPreferences: {
        nodeIntegration: boolean;
        contextIsolation: boolean;
        preload: string;
    };
}

export interface SplashScreenController {
    show(): void;
    hide(): void;
    updateProgress(progress: number): void;
    updateStatus(message: string): void;
    setTheme(theme: "light" | "dark"): void;
}

export class SplashWindow implements SplashScreenController {
    private window: BrowserWindow | null = null;
    private isVisible = false;

    constructor() {
        this.createWindow();
    }

    private createWindow(): void {
        try {
            this.window = new BrowserWindow({
                width: 480,
                height: 320,
                frame: false,
                resizable: false,
                alwaysOnTop: true,
                skipTaskbar: true,
                center: true,
                show: false,
                transparent: false,
                minimizable: false,
                maximizable: false,
                closable: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, "../preload/splash-preload.js"),
                    webSecurity: !is.dev,
                },
            });

            // 监听主题变化
            nativeTheme.on("updated", () => {
                this.setTheme(nativeTheme.shouldUseDarkColors ? "dark" : "light");
            });

            // 窗口事件处理
            this.window.on("closed", () => {
                this.window = null;
                this.isVisible = false;
            });

            logger.info("Splash window created successfully");
        } catch (error) {
            logger.error("Failed to create splash window:", error);
        }
    }

    show(): void {
        if (!this.window) {
            this.createWindow();
        }

        if (this.window && !this.isVisible) {
            try {
                // 加载闪屏 HTML
                // 无论开发环境还是生产环境，都直接从resources目录加载
                this.window.loadFile(path.join(__dirname, "../../resources/splash.html"));

                this.window.once("ready-to-show", () => {
                    if (this.window) {
                        this.window.show();
                        this.isVisible = true;
                        // 设置初始主题
                        this.setTheme(nativeTheme.shouldUseDarkColors ? "dark" : "light");
                        logger.info("Splash screen shown");
                    }
                });
            } catch (error) {
                logger.error("Failed to show splash window:", error);
            }
        }
    }

    hide(): void {
        logger.info(
            `Attempting to hide splash screen - window exists: ${!!this.window}, isVisible: ${this.isVisible}`,
        );

        if (this.window) {
            try {
                // 直接销毁窗口 - 最可靠的方式
                this.window.destroy();
                this.window = null;
                this.isVisible = false;
                logger.info("Splash screen destroyed successfully");
            } catch (error) {
                logger.error("Failed to destroy splash window:", error);
                // 即使出错也要清理状态
                this.window = null;
                this.isVisible = false;
            }
        } else {
            logger.warn("Splash window already null, updating state");
            this.isVisible = false;
        }
    }

    updateProgress(progress: number): void {
        if (this.window && this.isVisible) {
            try {
                this.window.webContents.send("splash:progress-update", progress);
            } catch (error) {
                logger.error("Failed to update splash progress:", error);
            }
        }
    }

    updateStatus(message: string): void {
        if (this.window && this.isVisible) {
            try {
                this.window.webContents.send("splash:status-update", message);
                logger.debug(`Splash status: ${message}`);
            } catch (error) {
                logger.error("Failed to update splash status:", error);
            }
        }
    }

    setTheme(theme: "light" | "dark"): void {
        if (this.window && this.isVisible) {
            try {
                this.window.webContents.send("splash:theme-changed", theme);
            } catch (error) {
                logger.error("Failed to set splash theme:", error);
            }
        }
    }

    // 检查窗口是否存在且可见
    isReady(): boolean {
        return this.window !== null && this.isVisible;
    }

    // 等待窗口准备就绪
    async waitForReady(timeout = 5000): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isReady()) {
                resolve();
                return;
            }

            const timer = setTimeout(() => {
                reject(new Error("Splash window timeout"));
            }, timeout);

            const checkReady = () => {
                if (this.isReady()) {
                    clearTimeout(timer);
                    resolve();
                } else {
                    setTimeout(checkReady, 50);
                }
            };

            checkReady();
        });
    }

    // 淡出动画关闭窗口
    fadeOut(callback: () => void): void {
        if (!this.window) {
            callback();
            return;
        }

        let opacity = 1.0;
        const fadeInterval = setInterval(() => {
            opacity -= 0.1;
            if (opacity <= 0) {
                clearInterval(fadeInterval);
                this.hide();
                callback();
            } else {
                this.window?.setOpacity(opacity);
            }
        }, 30); // 300ms 淡出动画
    }

    // 销毁窗口
    destroy(): void {
        if (this.window) {
            this.window.destroy();
            this.window = null;
            this.isVisible = false;
        }
    }
}
