import type { BrowserWindow } from "electron";
import type { NotifyPayload } from "@photasa/common";

/**
 * 扫描状态 notify 的 IPC 桥：将已构造的 payload 送到渲染进程（Electron 专用）。
 */
export function notifyStatus(mainWindow: BrowserWindow, payload: NotifyPayload): void {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("notify:status", payload);
}
