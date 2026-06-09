/**
 * 天枢适配器
 * 适配天枢工作流引擎 API
 */

import { isTauri } from "./env";

export interface Fulu {
    intent?: string;
    inputs?: Record<string, unknown>;
    params?: Record<string, unknown>;
}

export interface ZhaolingResponse {
    success: boolean;
    result?: any;
    error?: string;
}

const TIANSHU_READY_STATUS = "ready";
const TIANSHU_POLL_INTERVAL_MS = 100;
const TIANSHU_READY_TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function normalizeTianshuCommand(command: Fulu): Fulu {
    const intent = command.intent;
    const inputs = command.inputs ?? command.params ?? {};
    return {
        intent,
        inputs,
        params: inputs,
    };
}

export const tianshuAdapter = {
    /**
     * 等待天枢服务就绪（避免启动竞态导致「天枢服务尚未就绪」）
     */
    waitUntilReady: async (timeoutMs = TIANSHU_READY_TIMEOUT_MS): Promise<void> => {
        if (!isTauri()) {
            return;
        }
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
            const status = await tianshuAdapter.getStatus();
            if (status.status === TIANSHU_READY_STATUS) {
                return;
            }
            await sleep(TIANSHU_POLL_INTERVAL_MS);
        }
        throw new Error("天枢服务尚未就绪");
    },

    /**
     * 处理天枢命令
     */
    processCommand: async (fulu: Fulu): Promise<ZhaolingResponse> => {
        const command = normalizeTianshuCommand(fulu);
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            return await invoke("tianshu_command", { command });
        }
        const processCommand = (
            window as unknown as {
                electronAPI?: { tianshu?: { processCommand: (c: Fulu) => Promise<ZhaolingResponse> } };
            }
        ).electronAPI?.tianshu?.processCommand;
        if (!processCommand) {
            throw new Error("electronAPI.tianshu.processCommand 不可用");
        }
        return await processCommand(command);
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
