/**
 * RFC 0137：扁平 Photasa API 单例（Tauri invoke + 事件），替代组件层直接读 `window.api`。
 * `adapter.ts` 仍将同一实例挂到 `window.api` 供遗留调用；新代码应 import 本模块。
 */
import { createLegacyApi } from "@renderer/api/legacy-api";
import type { PhotasaFlatApi } from "./photasa-flat-api";

/** 与 legacy preload `window.api` 同形的扁平 API */
export type { PhotasaFlatApi };

let cachedApi: PhotasaFlatApi | null = null;

/** 惰性单例，避免重复构建 legacy 兼容层 */
export function getPhotasaApi(): PhotasaFlatApi {
    if (typeof window !== "undefined" && (window as Window & { api?: PhotasaFlatApi }).api) {
        return (window as Window & { api: PhotasaFlatApi }).api;
    }
    if (!cachedApi) {
        cachedApi = createLegacyApi();
    }
    return cachedApi;
}
