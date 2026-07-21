import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";
import {
    SIMING_COMMANDS,
    executeSimingZhaoling,
    extractFolderTreeFromContext,
} from "../siming-bridge";

const mockInvoke = vi.fn();
const mockIsTauri = vi.fn(() => true);

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@renderer/api/env", () => ({
    isTauri: () => mockIsTauri(),
}));

describe("siming-bridge", () => {
    beforeEach(() => {
        mockInvoke.mockReset();
        mockIsTauri.mockReturnValue(true);
    });

    it("extractFolderTreeFromContext 要求 tree 数组", () => {
        expect(extractFolderTreeFromContext({ tree: [{ key: "/a" }] })).toEqual([{ key: "/a" }]);
        expect(() => extractFolderTreeFromContext({ tree: "bad" })).toThrow(
            "update_folder_tree 缺少 tree 数组",
        );
    });

    it("UPDATE_FOLDER_TREE 走 siming_update_folder_tree", async () => {
        const tree = [{ key: "/Volumes/SUCAI/Test", title: "Test", children: [] }];
        mockInvoke.mockResolvedValue({ folderTree: tree, persisted: true });

        const result = await executeSimingZhaoling(ZOUZHE_MATTERS.UPDATE_FOLDER_TREE, { tree });

        expect(mockInvoke).toHaveBeenCalledWith(SIMING_COMMANDS.UPDATE_FOLDER_TREE, { tree });
        expect(result).toEqual({ folderTree: tree, persisted: true });
    });

    it("RESTORE_APP_STATE 走 siming_restore_app_state", async () => {
        const appState = { folderTree: [], currentFolder: null };
        mockInvoke.mockResolvedValue(appState);

        const result = await executeSimingZhaoling(ZOUZHE_MATTERS.RESTORE_APP_STATE, {});

        expect(mockInvoke).toHaveBeenCalledWith(SIMING_COMMANDS.RESTORE_APP_STATE);
        expect(result).toEqual(appState);
    });

    it("非 Tauri 环境应拒绝司命持久化", async () => {
        mockIsTauri.mockReturnValue(false);

        await expect(executeSimingZhaoling(ZOUZHE_MATTERS.RESTORE_APP_STATE, {})).rejects.toThrow(
            "司命持久化仅支持 Tauri 环境",
        );
    });

    it("未支持的诏令应抛错", async () => {
        await expect(
            executeSimingZhaoling("unknown_command" as typeof ZOUZHE_MATTERS.RESTORE_APP_STATE, {}),
        ).rejects.toThrow("未支持的司命诏令");
    });
});
