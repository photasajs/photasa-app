/**
 * Splash Screen Preload Script
 * 为启动画面提供有限的IPC通信接口
 */

import { contextBridge, ipcRenderer } from "electron";

// 为启动画面提供的API接口
const splashAPI = {
    // 监听主题变化
    onThemeChanged: (callback: (theme: "light" | "dark") => void) => {
        ipcRenderer.on("splash:theme-changed", (_, theme) => callback(theme));
    },

    // 监听状态更新
    onStatusUpdate: (callback: (message: string) => void) => {
        ipcRenderer.on("splash:status-update", (_, message) => callback(message));
    },

    // 监听进度更新
    onProgressUpdate: (callback: (progress: number) => void) => {
        ipcRenderer.on("splash:progress-update", (_, progress) => callback(progress));
    },

    // 移除所有监听器（清理用）
    removeAllListeners: () => {
        ipcRenderer.removeAllListeners("splash:theme-changed");
        ipcRenderer.removeAllListeners("splash:status-update");
        ipcRenderer.removeAllListeners("splash:progress-update");
    },
};

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld("splashAPI", splashAPI);

// 类型声明（用于TypeScript支持）
declare global {
    interface Window {
        splashAPI: typeof splashAPI;
    }
}
