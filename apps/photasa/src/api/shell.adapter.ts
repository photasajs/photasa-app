/**
 * Shell 适配器
 * 适配 Shell 操作 API
 */

import { isTauri } from "./env";
import { getLegacyPreloadApi, getLegacyShell } from "./legacy-preload-access";

export const shellAdapter = {
    /**
     * 在默认浏览器中打开 URL
     */
    openExternal: async (url: string): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("open_external", { url });
        } else {
            await getLegacyPreloadApi()?.shell?.openExternal(url);
        }
    },

    /**
     * 在文件管理器中显示文件
     */
    showInFolder: async (path: string): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("show_in_folder", { path });
        } else {
            await getLegacyPreloadApi()?.shell?.showItemInFolder(path);
        }
    },
};
