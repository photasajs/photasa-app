import { electronAPI } from "@electron-toolkit/preload";

const { ipcRenderer } = electronAPI;

export function openInFinder(path: string): void {
    ipcRenderer.send("picasa:open-in-finder", { path });
}
