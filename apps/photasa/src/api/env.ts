/**
 * 环境检测工具
 * 检测当前运行环境（Tauri 或 Electron）
 */

/**
 * 检测当前是否在 Tauri 环境中运行
 */
export const isTauri = (): boolean => {
    return typeof window !== "undefined" && typeof (window as any).__TAURI__ !== "undefined";
};

/**
 * 获取 Tauri invoke 函数
 * 动态导入 Tauri API
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
export const getEnvInfo = () => {
    return {
        isTauri: isTauri(),
        isElectron:
            typeof window !== "undefined" && typeof (window as any).electronAPI !== "undefined",
        platform: isTauri() ? "tauri" : "electron",
    };
};
