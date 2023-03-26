import { electronAPI } from "@electron-toolkit/preload";
import type { ConfigCallback } from "./types";

const { ipcRenderer } = electronAPI;

export function queryPhotasaConfigs(paths: string[], callback: ConfigCallback): void {
    ipcRenderer.send("picasa:query-config", { paths });

    ipcRenderer.on("picasa:photasa-config", (_, args) => {
        callback(args.action, args.paths || [args.err.message]);
    });
}

export async function scanSubfolders(folder: string): Promise<string[]> {
    return ipcRenderer.invoke("picasa:sub-folders", { parent: folder });
}
