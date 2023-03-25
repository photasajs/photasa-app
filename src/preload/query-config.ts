import { electronAPI } from "@electron-toolkit/preload";

const { ipcRenderer } = electronAPI;

export async function queryPhotasaConfigs(paths: string[]): Promise<string[]> {
    return ipcRenderer.invoke("picasa:query-config", { paths });
}
