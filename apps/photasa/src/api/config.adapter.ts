/**
 * 配置适配器
 * 适配配置服务 API
 */

import { isTauri } from "./env";
import { callLegacyPreloadSection } from "./legacy-preload-access";

export const configAdapter = {
    /**
     * 查询配置
     */
    query: async (paths: string[]): Promise<string[]> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            return await invoke("query_config", { paths });
        }
        return (await callLegacyPreloadSection("config", "query", paths)) as string[];
    },

    /**
     * 添加配置
     */
    add: async (paths: string[]): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("add_config", { paths });
        } else {
            await callLegacyPreloadSection("config", "add", paths);
        }
    },

    /**
     * 移除配置
     */
    remove: async (paths: string[]): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("remove_config", { paths });
        } else {
            await callLegacyPreloadSection("config", "remove", paths);
        }
    },
};
