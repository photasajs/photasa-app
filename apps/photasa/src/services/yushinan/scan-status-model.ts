import type { IScanning } from "@renderer/interfaces/fang-xuan-ling.interface";

export interface ScanStatusView {
    isScanning: boolean;
    path: string;
}

export function deriveScanStatusView(scanning: IScanning): ScanStatusView {
    if (!scanning.isProcessing) {
        return { isScanning: false, path: "" };
    }

    const path = scanning.currentPath ?? scanning.nextScanAction?.path ?? "";
    return { isScanning: path.length > 0, path };
}
