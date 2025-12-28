/**
 * 单实例管理器
 * 处理应用程序的单实例约束和窗口管理
 */

import { app, BrowserWindow } from "electron";
import { loggers } from "@photasa/common";

const logger = loggers.main;

export interface SingleInstanceConfig {
    appName: string;
    focusOnSecondInstance: boolean;
    restoreMinimizedWindow: boolean;
    createWindowOnMacOS: boolean;
}

export class SingleInstanceManager {
    private config: SingleInstanceConfig;
    private hasLock = false;

    constructor(config: Partial<SingleInstanceConfig> = {}) {
        this.config = {
            appName: "Photasa",
            focusOnSecondInstance: true,
            restoreMinimizedWindow: true,
            createWindowOnMacOS: true,
            ...config,
        };
    }

    /**
     * 初始化单实例管理
     * @returns 是否成功获得单实例锁
     */
    initialize(): boolean {
        this.hasLock = app.requestSingleInstanceLock();

        if (!this.hasLock) {
            logger.info(
                `Another instance of ${this.config.appName} is already running, quitting...`,
            );
            this.quitGracefully();
            return false;
        }

        logger.info(`${this.config.appName} acquired single instance lock`);
        this.setupSecondInstanceHandler();
        return true;
    }

    /**
     * 设置第二实例处理器
     */
    private setupSecondInstanceHandler(): void {
        app.on("second-instance", (_event, commandLine, workingDirectory) => {
            logger.info("Second instance detected", {
                commandLine: commandLine.slice(1), // 移除可执行文件路径
                workingDirectory,
            });

            this.handleSecondInstance(commandLine, workingDirectory);
        });
    }

    /**
     * 处理第二实例启动
     */
    private handleSecondInstance(commandLine: string[], workingDirectory: string): void {
        const mainWindow = this.getCurrentMainWindow();

        if (mainWindow) {
            this.focusExistingWindow(mainWindow);
        } else {
            this.handleMissingWindow();
        }

        // 处理命令行参数（如果有的话）
        this.processCommandLineArgs(commandLine, workingDirectory);
    }

    /**
     * 聚焦现有窗口
     */
    private focusExistingWindow(window: BrowserWindow): void {
        if (!this.config.focusOnSecondInstance) {
            return;
        }

        try {
            // 恢复最小化的窗口
            if (this.config.restoreMinimizedWindow && window.isMinimized()) {
                window.restore();
                logger.debug("Restored minimized window");
            }

            // 聚焦窗口
            window.focus();
            window.show();

            // 在某些平台上，我们可能需要额外的操作来确保窗口置顶
            if (process.platform === "win32") {
                window.setAlwaysOnTop(true);
                window.setAlwaysOnTop(false);
            }

            logger.info("Focused existing window on second instance");
        } catch (error) {
            logger.error("Failed to focus existing window:", error);
        }
    }

    /**
     * 处理窗口缺失的情况
     */
    private handleMissingWindow(): void {
        if (process.platform === "darwin" && this.config.createWindowOnMacOS) {
            // 在 macOS 上，应用可能仍在运行但窗口被关闭
            logger.info("No main window found on macOS, attempting to recreate");
            this.notifyWindowRecreationNeeded();
        } else {
            logger.warn("No main window found and not configured to recreate");
        }
    }

    /**
     * 通知需要重新创建窗口
     */
    private notifyWindowRecreationNeeded(): void {
        // 发出自定义事件，让主进程处理窗口重建
        app.emit("single-instance-window-recreate-needed");
    }

    /**
     * 处理命令行参数
     */
    private processCommandLineArgs(commandLine: string[], workingDirectory: string): void {
        // 检查是否有文件路径参数
        const fileArgs = commandLine.slice(1).filter((arg) => {
            return (
                !arg.startsWith("-") &&
                (arg.includes(".") || arg.includes("/") || arg.includes("\\"))
            );
        });

        if (fileArgs.length > 0) {
            logger.info("Second instance launched with file arguments:", fileArgs);

            // 发出事件让主应用处理文件打开
            app.emit("second-instance-files", {
                files: fileArgs,
                workingDirectory,
            });
        }

        // 检查其他特殊参数
        const hasDebugFlag = commandLine.includes("--debug");
        const hasDevFlag = commandLine.includes("--dev");

        if (hasDebugFlag || hasDevFlag) {
            logger.info("Second instance launched with debug/dev flags");
            app.emit("second-instance-debug-mode");
        }
    }

    /**
     * 获取当前主窗口
     */
    private getCurrentMainWindow(): BrowserWindow | null {
        const windows = BrowserWindow.getAllWindows();

        // 查找主窗口（通常是第一个或标题为应用名称的窗口）
        const mainWindow = windows.find((window) => {
            return (
                window.getTitle().includes(this.config.appName) ||
                window.webContents.getURL().includes("index.html") ||
                windows.indexOf(window) === 0
            );
        });

        return mainWindow || null;
    }

    /**
     * 优雅退出应用
     */
    private quitGracefully(): void {
        // 给其他代码一点时间来清理
        setTimeout(() => {
            app.quit();
        }, 100);
    }

    /**
     * 检查是否有单实例锁
     */
    hasInstanceLock(): boolean {
        return this.hasLock;
    }

    /**
     * 释放单实例锁（通常在应用退出时自动处理）
     */
    releaseLock(): void {
        if (this.hasLock) {
            app.releaseSingleInstanceLock();
            this.hasLock = false;
            logger.info("Released single instance lock");
        }
    }

    /**
     * 获取配置
     */
    getConfig(): SingleInstanceConfig {
        return { ...this.config };
    }

    /**
     * 更新配置
     */
    updateConfig(newConfig: Partial<SingleInstanceConfig>): void {
        this.config = { ...this.config, ...newConfig };
        logger.debug("Updated single instance config:", this.config);
    }

    /**
     * 获取当前运行的实例统计信息
     */
    getInstanceInfo(): {
        hasLock: boolean;
        appName: string;
        windowCount: number;
        platform: string;
    } {
        return {
            hasLock: this.hasLock,
            appName: this.config.appName,
            windowCount: BrowserWindow.getAllWindows().length,
            platform: process.platform,
        };
    }
}
