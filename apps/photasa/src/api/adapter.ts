/**
 * Tauri API 适配层
 * 提供统一的 API 接口，将 Electron API 调用转换为 Tauri API
 */

import { invoke } from "@tauri-apps/api/tauri";

/**
 * 窗口 API 适配
 */
export const windowApi = {
  minimize: () => invoke("minimize_window"),
  maximize: () => invoke("maximize_window"),
  unmaximize: () => invoke("unmaximize_window"),
  close: () => invoke("close_window"),
  isMaximized: () => invoke<boolean>("is_maximized"),
};

/**
 * 统一 API 接口（未来将扩展）
 */
export const api = {
  window: windowApi,
  // 未来将添加更多 API
  // tianshu: { ... },
  // import: { ... },
  // scan: { ... },
};

// 在全局对象上暴露 API（兼容 Electron 代码）
declare global {
  interface Window {
    api: typeof api;
  }
}

if (typeof window !== "undefined") {
  window.api = api;
}
