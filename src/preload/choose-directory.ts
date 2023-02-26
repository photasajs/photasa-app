import { electronAPI } from "@electron-toolkit/preload";

const { ipcRenderer } = electronAPI;

export interface DirectorySelection {
    filePaths: string[];
}

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
