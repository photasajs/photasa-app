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

export interface ScanFileReportPayload {
    type: "file" | "progress";
    requestId: string;
    rootPath: string;
    file?: {
        path: string;
        isDirectory: boolean;
    };
    action?: {
        path: string;
        isDirectory?: boolean;
    };
    currentFile?: string;
    progress?: {
        processed: number;
        total: number;
    };
}

export interface ScanDirectoryReportPayload {
    type: "directory";
    requestId: string;
    rootPath: string;
    directory?: {
        path: string;
        isDirectory: boolean;
    };
    action?: {
        path: string;
        isDirectory?: boolean;
    };
}

export interface ScanTerminalReportPayload {
    type: "complete" | "error";
    requestId: string;
    rootPath?: string;
    action?: {
        path: string;
        isDirectory?: boolean;
    };
    error?: string;
}

import type { ScanReport } from "@photasa/common";
import { callLegacyPreloadSection } from "./legacy-preload-access";

export type ScanReportEvent = ScanReport;

export interface ScanResult {
    type: "file" | "directory" | "progress" | "complete" | "error";
    requestId: string;
    paths?: string[];
    error?: string;
    file?: { path: string; isDirectory: boolean };
    directory?: { path: string; isDirectory: boolean };
    rootPath?: string;
    action?: {
        path: string;
        isDirectory?: boolean;
    };
    currentFile?: string;
    progress?: { processed: number; total: number };
    fileCount?: number;
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
            await callLegacyPreloadSection("scan", "scanPhotos", requestId, scanAction);
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
            // contract reference 监听
            const handler = (_event: unknown, result: ScanResult) => callback(result);
            callLegacyPreloadSection("scan", "onResult", handler);
            return () => {
                callLegacyPreloadSection("scan", "offResult", handler);
            };
        }
    },
};
