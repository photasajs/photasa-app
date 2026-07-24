/**
 * Tauri API 适配层
 * RFC 0154 迁移期内部聚合：仅供 legacy-api 委托，Phase 3 删除。
 */

import { isTauri } from "./env";
import { windowAdapter } from "./window.adapter";
import { shellAdapter } from "./shell.adapter";
import { scanAdapter } from "./scan.adapter";
import { importAdapter } from "./import.adapter";
import { configAdapter } from "./config.adapter";

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

    /** 导入服务 */
    import: importAdapter,

    /** 配置服务 */
    config: configAdapter,

    /** 环境信息 */
    env: {
        isTauri: isTauri(),
        platform: isTauri() ? "tauri" : "legacy",
    },
};

export default api;
