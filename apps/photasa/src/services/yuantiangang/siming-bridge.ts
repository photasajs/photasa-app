/**
 * 司命 appState 持久化桥接（RFC 0145）
 *
 * folderTree / restore_app_state 直连 Rust `photasa-folder-tree`，不经 zouwu workflow。
 */

import { invoke } from "@tauri-apps/api/core";
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";
import { isTauri } from "@renderer/api/env";

/** 与 `commands/siming.rs` 一致 */
export const SIMING_COMMANDS = {
    UPDATE_FOLDER_TREE: "siming_update_folder_tree",
    RESTORE_APP_STATE: "siming_restore_app_state",
} as const;

type SimingZhaolingCommand =
    | typeof ZOUZHE_MATTERS.UPDATE_FOLDER_TREE
    | typeof ZOUZHE_MATTERS.RESTORE_APP_STATE;

export type SimingUpdateFolderTreeResult = {
    folderTree: unknown[];
    persisted: boolean;
};

/** 从奏折 context 提取 folderTree 数组 */
export function extractFolderTreeFromContext(context: Record<string, unknown>): unknown[] {
    const tree = context.tree;
    if (!Array.isArray(tree)) {
        throw new Error("update_folder_tree 缺少 tree 数组");
    }
    return tree;
}

/**
 * 袁天罡司命奏折：invoke Rust（读写 ~/.photasa/appState/photasa.json）
 */
export async function executeSimingZhaoling(
    command: SimingZhaolingCommand,
    context: Record<string, unknown>,
): Promise<unknown> {
    if (!isTauri()) {
        throw new Error("司命持久化仅支持 Tauri 环境（~/.photasa/appState/photasa.json）");
    }

    if (command === ZOUZHE_MATTERS.UPDATE_FOLDER_TREE) {
        const tree = extractFolderTreeFromContext(context);
        return invoke<SimingUpdateFolderTreeResult>(SIMING_COMMANDS.UPDATE_FOLDER_TREE, { tree });
    }

    if (command === ZOUZHE_MATTERS.RESTORE_APP_STATE) {
        return invoke<Record<string, unknown>>(SIMING_COMMANDS.RESTORE_APP_STATE);
    }

    throw new Error(`未支持的司命诏令: ${command}`);
}
