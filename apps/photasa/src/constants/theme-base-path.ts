/**
 * Vite 将 `src/themes/**` 挂到站点根下的 `/src/themes`。
 * Photasa 与旧 Electron 路径不同，禁止使用 `/src/renderer/src/themes`（打包后会 404）。
 */
export const THEME_BASE_PATH = "/src/themes";
