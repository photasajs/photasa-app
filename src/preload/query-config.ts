import { electronAPI } from "@electron-toolkit/preload";
import {
    addToPhotasaConfig,
    removeFromPhotoList,
    getPhotasaConfig,
    resetPhotasaConfig,
    fixPhotasaConfig,
    cleanupQueueForFolder,
} from "../main/config-storage";

const { ipcRenderer } = electronAPI;

export async function scanSubfolders(folder: string): Promise<string[]> {
    return ipcRenderer.invoke("picasa:sub-folders", { parent: folder });
}

export function cleanupScanQueue(folderPath: string): void {
    cleanupQueueForFolder(folderPath);
}
