/**
 * 天枢适配器
 * 适配天枢工作流引擎 API
 */

import { isTauri } from "./env";

export interface Fulu {
    intent?: string;
    inputs?: any;
}

export interface ZhaolingResponse {
    success: boolean;
    result?: any;
    error?: string;
}

export const tianshuAdapter = {
    /**
     * 处理天枢命令
     *
     * 初期使用 stub 返回，逐步替换为真实实现
     */
    processCommand: async (fulu: Fulu): Promise<ZhaolingResponse> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            return await invoke("tianshu_command", { command: fulu });
        } else {
            // Electron 实现（兼容模式）
            return await (window as any).electronAPI?.tianshu?.processCommand(fulu);
        }
    },

    /**
     * 获取天枢状态
     */
    getStatus: async (): Promise<{ workflows: number; status: string }> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            return await invoke("tianshu_status");
        } else {
            return await (window as any).electronAPI?.tianshu?.getStatus();
        }
    },
};
