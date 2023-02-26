import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import { startWatching } from "./fs-watch";
import { importPhotos } from "./photo-import";
import { chooseDirectory } from "./choose-directory";

// Custom APIs for renderer
const api = {
    startWatching,
    importPhotos,
    chooseDirectory,
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld("electron", electronAPI);
        contextBridge.exposeInMainWorld("api", api);
    } catch (error) {
        console.error(error);
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI;
    // @ts-ignore (define in dts)
    window.api = api;
}
