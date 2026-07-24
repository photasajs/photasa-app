/**
 * RFC 0137：扁平 Photasa API 模块单例（Tauri invoke + 事件）。
 * RFC 0154：迁移期兼容入口；新代码禁止使用。
 */
import { createLegacyApi } from "@renderer/api/legacy-api";
import type { PhotasaFlatApi } from "./photasa-flat-api";

/** 与 legacy preload `window.api` 同形的扁平 API */
export type { PhotasaFlatApi };

let cachedApi: PhotasaFlatApi | null = null;

/**
 * 惰性模块单例，避免重复构建 legacy 兼容层。
 *
 * @deprecated RFC 0154：改用负责人物服务；Phase 3 删除。
 */
export function getPhotasaApi(): PhotasaFlatApi {
    if (!cachedApi) {
        cachedApi = createLegacyApi();
    }
    return cachedApi;
}
