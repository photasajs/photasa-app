/**
 * 窗口适配器
 * 适配窗口控制 API
 */

import { isTauri } from "./env";
import { callLegacyPreloadSection } from "./legacy-preload-access";

export const windowAdapter = {
    /**
     * 最小化窗口
     */
    minimize: async (): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("minimize_window");
        } else {
            await callLegacyPreloadSection("window", "minimize");
        }
    },

    /**
     * 最大化/还原窗口
     */
    maximize: async (): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("maximize_window");
        } else {
            await callLegacyPreloadSection("window", "maximize");
        }
    },

    /**
     * 关闭窗口
     */
    close: async (): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("close_window");
        } else {
            await callLegacyPreloadSection("window", "close");
        }
    },

    /**
     * 检查是否最大化
     */
    isMaximized: async (): Promise<boolean> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            return await invoke<boolean>("is_maximized");
        }
        return (
            ((await callLegacyPreloadSection("window", "isMaximized")) as boolean | undefined) ??
            false
        );
    },
};
