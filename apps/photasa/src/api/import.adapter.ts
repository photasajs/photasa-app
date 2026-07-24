/**
 * 导入适配器
 * 适配导入服务 API（类型与 @photasa/common 一致，便于与 legacy-api / Rust 事件对齐）
 */

import type { DirectorySelection } from "@photasa/common";
import { isTauri } from "./env";
import { callLegacyPreloadSection } from "./legacy-preload-access";

export type { DirectorySelection };

export const importAdapter = {
    /**
     * 单选/多选目录（与 legacy-api `chooseDirectories` 返回形状一致）
     */
    chooseDirectories: async (multiSelect = true): Promise<DirectorySelection> => {
        if (isTauri()) {
            const { open } = await import("@tauri-apps/plugin-dialog");
            const selected = await open({ directory: true, multiple: multiSelect });
            if (Array.isArray(selected)) {
                return { filePaths: selected };
            } else if (typeof selected === "string") {
                return { filePaths: [selected] };
            }
            return { filePaths: [] };
        }
        const out = (await callLegacyPreloadSection("api", "chooseDirectories", multiSelect)) as
            | DirectorySelection
            | undefined;
        return out ?? { filePaths: [] };
    },
};
