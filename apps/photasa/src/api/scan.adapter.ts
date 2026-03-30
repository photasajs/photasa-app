/**
 * 扫描适配器
 * 适配扫描服务 API
 */

import { isTauri } from "./env";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface ScanAction {
    path: string;
    operationType: "file" | "directory";
    action: "scan" | "rescan" | "current";
    thumbnailSize?: number;
}

export interface ScanResult {
    type: "progress" | "complete" | "error";
    requestId: string;
    paths?: string[];
    error?: string;
    file?: any;
}

export const scanAdapter = {
    /**
     * 扫描照片
     */
    scanPhotos: async (requestId: string, scanAction: ScanAction): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("scan_photos", { requestId, scanAction });
        } else {
            await (window as any).electronAPI?.scan?.scanPhotos(requestId, scanAction);
        }
    },

    /**
     * 监听扫描结果
     */
    onScanResult: async (
        callback: (result: ScanResult) => void,
    ): Promise<UnlistenFn | (() => void)> => {
        if (isTauri()) {
            return await listen<ScanResult>("picasa:find-photo", (event) => {
                callback(event.payload);
            });
        } else {
            // Electron 监听
            const handler = (_event: any, result: ScanResult) => callback(result);
            (window as any).electronAPI?.scan?.onResult(handler);
            return () => {
                (window as any).electronAPI?.scan?.offResult(handler);
            };
        }
    },
};
