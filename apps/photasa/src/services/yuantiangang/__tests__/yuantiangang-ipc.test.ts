import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";
import { YuanTianGangService } from "../yuantiangang";
import {
    FOLDER_TREE_COMMANDS,
    PREFERENCES_COMMANDS,
    SCAN_QUEUE_COMMANDS,
} from "../tauri-command-names";

import { QizouMatters } from "@renderer/constants/qizou-shengzhi-commands";

const mockInvoke = vi.fn();
const mockListen = vi.fn();
const mockIsTauri = vi.fn(() => true);
const mockQizouEmit = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
    listen: (...args: unknown[]) => mockListen(...args),
}));

vi.mock("@renderer/api/env", () => ({
    isTauri: () => mockIsTauri(),
}));

function createServiceWithQizouBus(): YuanTianGangService {
    const service = new YuanTianGangService();
    service.setQizouBus({ emit: mockQizouEmit } as never);
    return service;
}

describe("YuanTianGangService executeZhaoling IPC", () => {
    let service: YuanTianGangService;

    beforeEach(() => {
        mockInvoke.mockReset();
        mockListen.mockReset();
        mockListen.mockResolvedValue(() => {});
        mockQizouEmit.mockReset();
        mockIsTauri.mockReturnValue(true);
        service = createServiceWithQizouBus();
    });

    it("Tauri 模式下 menu:action 直连 listen(picasa:menu-action)（RFC 0149）", () => {
        expect(mockListen).toHaveBeenCalledWith("picasa:menu-action", expect.any(Function));
    });

    it("UPDATE_FOLDER_TREE invoke folder_tree_update", async () => {
        const tree = [{ key: "/Volumes/SUCAI/Test", title: "Test", children: [] }];
        mockInvoke.mockResolvedValue({ folderTree: tree, persisted: true });

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.UPDATE_FOLDER_TREE,
            context: { tree },
            timestamp: Date.now(),
            source: "魏征",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith(FOLDER_TREE_COMMANDS.UPDATE, { tree });
        expect(result.acknowledged).toBe(true);
        expect(result.data).toEqual({ folderTree: tree, persisted: true });
    });

    it("RESTORE_APP_STATE invoke app_state_restore", async () => {
        const appState = { folderTree: [], currentFolder: null };
        mockInvoke.mockResolvedValue(appState);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.RESTORE_APP_STATE,
            context: {},
            timestamp: Date.now(),
            source: "魏征",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith(FOLDER_TREE_COMMANDS.RESTORE_APP_STATE);
        expect(result.acknowledged).toBe(true);
        expect(result.data).toEqual(appState);
    });

    it("GET_SCANNING_QUEUE invoke scan_queue_get", async () => {
        mockInvoke.mockResolvedValue([{ path: "/restored", action: "scan", timestamp: 1 }]);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.GET_SCANNING_QUEUE,
            context: {},
            timestamp: Date.now(),
            source: "尉迟恭",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith(SCAN_QUEUE_COMMANDS.GET);
        expect(result.acknowledged).toBe(true);
        expect((result.data as { queue: unknown[] }).queue).toHaveLength(1);
    });

    it("ADD_PATH invoke preferences_update 并启奏 add_path_completed", async () => {
        const delta = { scanning: { paths: ["/Volumes/Test"] } };
        const path = "/Volumes/Test";
        const snapshot = { ui: { theme: "dark" }, scanning: { paths: [path] } };
        mockInvoke.mockResolvedValue({ updated: delta, snapshot, revision: 2 });

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.ADD_PATH,
            context: { ...delta, path },
            timestamp: Date.now(),
            source: "褚遂良",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith(PREFERENCES_COMMANDS.UPDATE, {
            delta,
            source: "褚遂良",
        });
        expect(result.acknowledged).toBe(true);
        expect(mockQizouEmit).toHaveBeenCalledWith(
            "qizou",
            expect.objectContaining({
                matter: QizouMatters.ADD_PATH_COMPLETED,
                from: "袁天罡",
                content: { path },
            }),
        );
    });

    it("GET_PREFERENCES invoke preferences_get", async () => {
        const prefs = { ui: { theme: "light" } };
        mockInvoke.mockResolvedValue(prefs);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.GET_PREFERENCES,
            context: {},
            timestamp: Date.now(),
            source: "褚遂良",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith(PREFERENCES_COMMANDS.GET);
        expect(result.acknowledged).toBe(true);
        expect(result.data).toEqual(prefs);
    });

    it("UPDATE_MENU invoke apply_system_menu（RFC 0149/0150）", async () => {
        const menus = [{ key: "file", label: "File" }];
        mockInvoke.mockResolvedValue(undefined);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.UPDATE_MENU,
            context: { menus },
            timestamp: Date.now(),
            source: "长孙无忌",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith("apply_system_menu", { menus });
        expect(result.acknowledged).toBe(true);
    });

    it("OPEN_EXTERNAL invoke open_external（RFC 0149/0150）", async () => {
        mockInvoke.mockResolvedValue(undefined);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.OPEN_EXTERNAL,
            context: { url: "https://example.com" },
            timestamp: Date.now(),
            source: "长孙无忌",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith("open_external", { url: "https://example.com" });
        expect(result.acknowledged).toBe(true);
    });

    it("OPEN_IN_FINDER invoke show_in_folder（RFC 0149/0150）", async () => {
        mockInvoke.mockResolvedValue(undefined);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.OPEN_IN_FINDER,
            context: { path: "/tmp/photo.jpg" },
            timestamp: Date.now(),
            source: "长孙无忌",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith("show_in_folder", { path: "/tmp/photo.jpg" });
        expect(result.acknowledged).toBe(true);
    });
});
