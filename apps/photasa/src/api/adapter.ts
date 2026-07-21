/**
 * Tauri API 适配层
 * 提供统一的 API 接口，将 Electron API 调用转换为 Tauri API
 * RFC 0074/0075: 在 Tauri 下注入扁平 legacy API，与 legacy.ts 同形
 */

import { isTauri } from "./env";
import { windowAdapter } from "./window.adapter";
import { shellAdapter } from "./shell.adapter";
import { scanAdapter } from "./scan.adapter";
import { thumbnailAdapter } from "./thumbnail.adapter";
import { importAdapter } from "./import.adapter";
import { configAdapter } from "./config.adapter";
import { createLegacyApi } from "./legacy-api";

/**
 * 统一 API 接口（嵌套形态，供 legacy-api 内部委托）
 */
export const api = {
    /** 窗口控制 */
    window: windowAdapter,

    /** Shell 操作 */
    shell: shellAdapter,

    /** 扫描服务 */
    scan: scanAdapter,

    /** 缩略图服务 */
    thumbnail: thumbnailAdapter,

    /** 导入服务 */
    import: importAdapter,

    /** 配置服务 */
    config: configAdapter,

    /** 环境信息 */
    env: {
        isTauri: isTauri(),
        platform: isTauri() ? "tauri" : "electron",
    },
};

// 全局注入：始终使用扁平 legacy API（RFC 0075），与 legacy.ts 同形，避免 window.api.xxx 未定义
if (typeof window !== "undefined") {
    (window as any).api = createLegacyApi();
}

export default api;
