import { contextBridge } from "electron";
import { api } from "./legacy";
import { Tianshu } from "./tianshu";
import { ElectronAPI } from "@electron-toolkit/preload";

declare global {
    interface Window {
        electron: ElectronAPI;
        tianshu: typeof Tianshu;
        api: any;
    }
}

import { loggers } from "@photasa/common";

const logger = loggers.yuantiangang;

// TODO: remove this after migration to tianshu
import { electronAPI } from "@electron-toolkit/preload";

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        // TODO: remove this after migration to tianshu
        contextBridge.exposeInMainWorld("electron", electronAPI);
        contextBridge.exposeInMainWorld("tianshu", Tianshu);
        contextBridge.exposeInMainWorld("api", api);
    } catch (error) {
        logger.error(error);
    }
} else {
    // TODO: remove this after migration to tianshu
    window.electron = electronAPI;
    window.tianshu = Tianshu;
    window.api = api;
}
