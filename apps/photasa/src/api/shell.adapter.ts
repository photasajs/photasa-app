/**
 * Shell 适配器
 * 适配系统 shell API（打开外部链接、在文件管理器中显示）
 */

import { isTauri } from "./env";
import { callLegacyPreloadSection } from "./legacy-preload-access";

export const shellAdapter = {
    /**
     * 在默认浏览器中打开 URL
     */
    openExternal: async (url: string): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("open_external", { url });
        } else {
            await callLegacyPreloadSection("shell", "openExternal", url);
        }
    },

    /**
     * 在文件管理器中显示文件/文件夹
     */
    showItemInFolder: async (path: string): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("show_item_in_folder", { path });
        } else {
            await callLegacyPreloadSection("shell", "showItemInFolder", path);
        }
    },
};
