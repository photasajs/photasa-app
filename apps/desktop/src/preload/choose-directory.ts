import { electronAPI } from "@electron-toolkit/preload";
import type { DirectorySelection, PathName } from "@common/types";

const { ipcRenderer } = electronAPI;

export function chooseDirectory(): Promise<DirectorySelection> {
    // Start file watching
    ipcRenderer?.send("picasa:choose-directory", {});

    return new Promise((resolve) => {
        // Response to event then save to pinia store
        ipcRenderer?.on("picasa:selected-directory", (_, arg) => {
            resolve(arg);
        });
    });
}

export function getDirectory(name: PathName): Promise<string> {
    // Start file watching
    return ipcRenderer?.invoke("picasa:get-directory", {
        name,
    });
}
