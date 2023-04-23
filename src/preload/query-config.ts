import { electronAPI } from "@electron-toolkit/preload";

const { ipcRenderer } = electronAPI;

export async function scanSubfolders(folder: string): Promise<string[]> {
    return ipcRenderer.invoke("picasa:sub-folders", { parent: folder });
}
