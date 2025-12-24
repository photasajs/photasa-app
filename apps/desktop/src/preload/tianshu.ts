import { electronAPI } from "@electron-toolkit/preload";

// ========== 天枢星君通信 API ==========
export const Tianshu = {
    /**
     * 向天枢发送命令（袁天罡符箓转天枢命令）
     */
    processCommand: (command: any) => electronAPI.ipcRenderer.invoke("tianshu.command", command),

    /**
     * 查询天枢状态
     */
    getStatus: () => electronAPI.ipcRenderer.invoke("tianshu.status"),

    /**
     * 监听天枢进度事件
     */
    onProgress: (callback: (progress: any) => void) => {
        const handler = (_: any, progress: any) => callback(progress);
        electronAPI.ipcRenderer.on("tianshu.progress", handler);
        return () => electronAPI.ipcRenderer.removeListener("tianshu.progress", handler);
    },

    /**
     * 监听天枢状态变更事件
     */
    onStatus: (callback: (status: any) => void) => {
        const handler = (_: any, status: any) => callback(status);
        electronAPI.ipcRenderer.on("tianshu.status", handler);
        return () => electronAPI.ipcRenderer.removeListener("tianshu.status", handler);
    },
};
