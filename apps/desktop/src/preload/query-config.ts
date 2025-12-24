import { electronAPI } from "@electron-toolkit/preload";

const { ipcRenderer } = electronAPI;

export async function scanSubfolders(folder: string): Promise<string[]> {
    return ipcRenderer.invoke("picasa:sub-folders", { parent: folder });
}

export async function checkPhotasaConfig(
    folderPath: string,
): Promise<{ hasConfig: boolean; photoCount?: number; reason: string }> {
    return ipcRenderer.invoke("picasa:check-photasa-config", folderPath);
}

export function cleanupScanQueue(): void {
    // cleanupQueueForFolder(folderPath);
}
