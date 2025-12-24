import { electronAPI } from "@electron-toolkit/preload";
import type { AutoUpdateConfig } from "@common/update-types";

const { ipcRenderer } = electronAPI;

/**
 * 更新相关的预加载API
 * 提供安全的IPC通信桥梁
 */
export const updateApi = {
    /**
     * 检查更新
     */
    checkForUpdates: (): Promise<{ hasUpdate: boolean; version?: string; info?: any }> => {
        return ipcRenderer.invoke("picasa:check-for-updates");
    },

    /**
     * 下载更新
     */
    downloadUpdate: (): Promise<void> => {
        return ipcRenderer.invoke("picasa:download-update");
    },

    /**
     * 安装更新并重启应用
     */
    installUpdate: (): Promise<void> => {
        return ipcRenderer.invoke("picasa:install-update");
    },

    /**
     * 获取更新状态
     */
    getUpdateStatus: (): Promise<{
        status: string;
        progress?: number;
        error?: string;
        version?: string;
        info?: any;
    }> => {
        return ipcRenderer.invoke("picasa:get-update-status");
    },

    /**
     * 获取应用版本
     */
    getAppVersion: (): Promise<string> => {
        return ipcRenderer.invoke("picasa:get-app-version");
    },

    /**
     * 更新自动更新配置
     */
    updateAutoUpdateConfig: (config: Partial<AutoUpdateConfig>): Promise<boolean> => {
        return ipcRenderer.invoke("picasa:update-auto-update-config", config);
    },

    /**
     * 监听更新进度
     */
    onUpdateProgress: (callback: (progress: number) => void) => {
        const handleProgress = (_event: any, progress: number) => callback(progress);
        ipcRenderer.on("picasa:update-progress", handleProgress);

        // 返回清理函数
        return () => {
            ipcRenderer.removeListener("picasa:update-progress", handleProgress);
        };
    },

    /**
     * 监听更新下载完成
     */
    onUpdateDownloaded: (callback: (info?: any) => void) => {
        const handleDownloaded = (_event: any, info?: any) => callback(info);
        ipcRenderer.on("picasa:update-downloaded", handleDownloaded);

        // 返回清理函数
        return () => {
            ipcRenderer.removeListener("picasa:update-downloaded", handleDownloaded);
        };
    },

    /**
     * 监听更新错误
     */
    onUpdateError: (callback: (error: string) => void) => {
        const handleError = (_event: any, error: string) => callback(error);
        ipcRenderer.on("picasa:update-error", handleError);

        // 返回清理函数
        return () => {
            ipcRenderer.removeListener("picasa:update-error", handleError);
        };
    },

    /**
     * 监听更新可用
     */
    onUpdateAvailable: (callback: (data: { version: string; info?: any }) => void) => {
        const handleAvailable = (_event: any, data: { version: string; info?: any }) =>
            callback(data);
        ipcRenderer.on("picasa:update-available", handleAvailable);

        // 返回清理函数
        return () => {
            ipcRenderer.removeListener("picasa:update-available", handleAvailable);
        };
    },

    /**
     * 监听状态变化
     */
    onStatusChanged: (
        callback: (status: {
            status: string;
            progress?: number;
            error?: string;
            version?: string;
            info?: any;
        }) => void,
    ) => {
        const handleStatusChange = (_event: any, status: any) => callback(status);
        ipcRenderer.on("picasa:update-status-changed", handleStatusChange);

        // 返回清理函数
        return () => {
            ipcRenderer.removeListener("picasa:update-status-changed", handleStatusChange);
        };
    },

    /**
     * 移除所有更新相关的事件监听器
     */
    removeAllUpdateListeners: () => {
        const updateEvents = [
            "picasa:update-progress",
            "picasa:update-downloaded",
            "picasa:update-error",
            "picasa:update-available",
            "picasa:update-status-changed",
        ];

        updateEvents.forEach((event) => {
            ipcRenderer.removeAllListeners(event);
        });
    },
};
