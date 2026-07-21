/**
 * 环境检测工具（Tauri）
 */
import { isTauri as coreIsTauri } from "@tauri-apps/api/core";

/**
 * 检测当前是否在 Tauri 环境中运行（官方 API，检查 globalThis.isTauri）
 */
export const isTauri = (): boolean => {
    try {
        return coreIsTauri();
    } catch {
        return (
            typeof window !== "undefined" &&
            typeof (window as Window & { __TAURI__?: unknown }).__TAURI__ !== "undefined"
        );
    }
};

/**
 * 获取 Tauri invoke 函数
 */
export const getTauriInvoke = async () => {
    if (!isTauri()) {
        throw new Error("Not running in Tauri environment");
    }
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke;
};

/**
 * 获取环境信息
 */
export const getEnvInfo = () => ({
    isTauri: isTauri(),
    platform: isTauri() ? ("tauri" as const) : ("unknown" as const),
});
