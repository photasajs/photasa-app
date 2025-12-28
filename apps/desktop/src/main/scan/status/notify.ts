import type { BrowserWindow } from "electron";
import type { NotifyPayload } from "@photasa/common";

/**
 * 通用 notify 状态推送工具
 * @param mainWindow 主窗口实例
 * @param payload NotifyPayload 状态消息
 */
export function notifyStatus(mainWindow: BrowserWindow, payload: NotifyPayload) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("notify:status", payload);
}
