import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";
import { YuanTianGangService } from "../yuantiangang";
import {
    FOLDER_TREE_COMMANDS,
    MENU_COMMANDS,
    PREFERENCES_COMMANDS,
    SCAN_QUEUE_COMMANDS,
    WATCH_COMMANDS,
    WATCH_EVENTS,
} from "../tauri-command-names";
import { SCAN_QUEUE_RESTORE_FROM_DISK } from "../scan-queue-contract";

import { QizouMatters } from "@renderer/constants/qizou-shengzhi-commands";
import { MENU_KEY_HELP_REPORT_ISSUE } from "@renderer/constants/menu-keys";

const mockInvoke = vi.fn();
const mockListen = vi.fn();
const mockDialogOpen = vi.fn();
const mockIsTauri = vi.fn(() => true);
const mockQizouEmit = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
    listen: (...args: unknown[]) => mockListen(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
    open: (...args: unknown[]) => mockDialogOpen(...args),
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
        setActivePinia(createPinia());
        mockInvoke.mockReset();
        mockListen.mockReset();
        mockListen.mockResolvedValue(() => {});
        mockDialogOpen.mockReset();
        mockQizouEmit.mockReset();
        mockIsTauri.mockReturnValue(true);
        service = createServiceWithQizouBus();
    });

    it("Tauri 模式下 menu:action 直连 listen(picasa:menu-action)（RFC 0149）", () => {
        expect(mockListen).toHaveBeenCalledWith("picasa:menu-action", expect.any(Function));
    });

    it("help-report-issue menu click emits MENU_ACTION qizou with stable key", () => {
        const listenCall = mockListen.mock.calls.find((call) => call[0] === "picasa:menu-action");
        expect(listenCall).toBeDefined();

        const handler = listenCall![1] as (event: { payload: { key: string } }) => void;
        handler({ payload: { key: MENU_KEY_HELP_REPORT_ISSUE } });

        expect(mockQizouEmit).toHaveBeenCalledWith(
            "qizou",
            expect.objectContaining({
                matter: QizouMatters.MENU_ACTION,
                content: expect.objectContaining({ key: MENU_KEY_HELP_REPORT_ISSUE }),
                from: "袁天罡",
            }),
        );
    });

    it("Tauri 模式下 picasa:add-to-scan-queue 直连 listen（RFC 0137）", () => {
        expect(mockListen).toHaveBeenCalledWith(WATCH_EVENTS.SCAN_QUEUE_ADD, expect.any(Function));
    });

    it("Tauri 模式下文件删除事件由袁天罡唯一监听并启奏", () => {
        const listenCall = mockListen.mock.calls.find(
            (call) => call[0] === WATCH_EVENTS.FILE_UNLINK,
        );
        expect(listenCall).toBeDefined();

        const handler = listenCall![1] as (event: { payload: unknown }) => void;
        handler({ payload: { path: "/photos/a.jpg", isFile: true } });

        expect(mockQizouEmit).toHaveBeenCalledWith(
            "qizou",
            expect.objectContaining({
                matter: QizouMatters.WATCH_PATH_REMOVED,
                content: { path: "/photos/a.jpg", isFile: true },
                from: "袁天罡",
            }),
        );
    });

    it("导入诏令由袁天罡用 Rust args 契约执行", async () => {
        mockInvoke.mockResolvedValue(undefined);

        const response = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.PAUSE_IMPORT,
            context: { importId: "import-1" },
            timestamp: Date.now(),
            source: "房玄龄",
            priority: "normal",
        });

        expect(response.acknowledged).toBe(true);
        expect(mockInvoke).toHaveBeenCalledWith("pause_import", {
            args: { importId: "import-1" },
        });
        for (const eventName of [
            "import:progress",
            "import:complete",
            "import:error",
            "import:preview-progress",
        ]) {
            expect(mockListen.mock.calls.filter(([name]) => name === eventName)).toHaveLength(1);
        }
    });

    it("图库元数据诏令只经袁天罡 private transport", async () => {
        mockInvoke.mockResolvedValue({ name: "a.jpg" });

        const response = await service.executeZhaoling({
            command: "extract_metadata",
            context: { path: "file:///photos/a.jpg" },
            timestamp: Date.now(),
            source: "魏征",
            priority: "normal",
        });

        expect(response).toMatchObject({
            acknowledged: true,
            data: { name: "a.jpg" },
        });
        expect(mockInvoke).toHaveBeenCalledWith("extract_metadata", {
            args: {
                request: {
                    filePath: "/photos/a.jpg",
                },
            },
        });
    });

    it("目录选择诏令只经袁天罡 private transport", async () => {
        mockDialogOpen.mockResolvedValue(["/photos/a", "/photos/b"]);

        const response = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.CHOOSE_DIRECTORIES,
            context: { multiple: true },
            timestamp: Date.now(),
            source: "长孙无忌",
            priority: "normal",
        });

        expect(response).toMatchObject({
            acknowledged: true,
            data: { filePaths: ["/photos/a", "/photos/b"] },
        });
        expect(mockDialogOpen).toHaveBeenCalledWith({
            directory: true,
            multiple: true,
        });
    });

    it("桌面能力门面不向 UI 暴露 command 字符串", async () => {
        mockInvoke.mockResolvedValue({ hasUpdate: false });

        await expect(service.updates.check()).resolves.toEqual({ hasUpdate: false });
        await service.logs.close();
        await service.windows.minimize();

        expect(mockInvoke.mock.calls).toEqual(
            expect.arrayContaining([
                ["check_for_updates"],
                ["log_viewer_close"],
                ["minimize_window"],
            ]),
        );
    });

    it("picasa:add-to-scan-queue 事件触发后启奏 watch_scan_queue_add", async () => {
        const listenCall = mockListen.mock.calls.find(
            (call) => call[0] === WATCH_EVENTS.SCAN_QUEUE_ADD,
        );
        expect(listenCall).toBeDefined();
        const handler = listenCall![1] as (event: { payload: unknown[] }) => void;
        const operations = [{ id: "op-1", type: "add", path: "/photos/a.jpg" }];
        handler({ payload: operations });

        expect(mockQizouEmit).toHaveBeenCalledWith(
            "qizou",
            expect.objectContaining({
                matter: QizouMatters.WATCH_SCAN_QUEUE_ADD,
                from: "袁天罡",
                content: { operations },
            }),
        );
    });

    it("START_FILE_WATCH invokes Rust watch command with config", async () => {
        const config = {
            paths: ["/photos", "/archive"],
            recursive: true,
            thumbnailSize: 240,
        };
        mockInvoke.mockResolvedValue(undefined);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.START_FILE_WATCH,
            context: config,
            timestamp: Date.now(),
            source: "秦琼",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith(WATCH_COMMANDS.START, { config });
        expect(result.acknowledged).toBe(true);
    });

    it("STOP_FILE_WATCH invokes Rust watch command", async () => {
        mockInvoke.mockResolvedValue(undefined);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.STOP_FILE_WATCH,
            context: {},
            timestamp: Date.now(),
            source: "秦琼",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith(WATCH_COMMANDS.STOP);
        expect(result.acknowledged).toBe(true);
    });

    it("CHECK_FOLDER_CONFIG invokes Rust command and preserves boolean", async () => {
        mockInvoke.mockResolvedValue(true);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.CHECK_FOLDER_CONFIG,
            context: { folderPath: "/photos" },
            timestamp: Date.now(),
            source: "魏征",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith("check_photasa_config", {
            folderPath: "/photos",
        });
        expect(result).toMatchObject({
            acknowledged: true,
            data: true,
        });
    });

    it("REMOVE_WATCH_FILE removes thumbnail and photo-list entry", async () => {
        mockInvoke
            .mockResolvedValueOnce({ success: true })
            .mockResolvedValueOnce({ path: "/photos/.photasa.json", config: { photoList: [] } });

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.REMOVE_WATCH_FILE,
            context: { path: "/photos/a.jpg" },
            timestamp: Date.now(),
            source: "秦琼",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenNthCalledWith(1, "remove_thumbnail", {
            request: {
                path: "/photos/a.jpg",
                thumbnail: "/photos/.photasaoriginals/thumbnail-a.jpg.png",
            },
        });
        expect(mockInvoke).toHaveBeenNthCalledWith(2, "remove_from_photo_list", {
            photoPath: "/photos/a.jpg",
        });
        expect(result.acknowledged).toBe(true);
        expect(result.data).toEqual({
            folder: "/photos",
            config: { photoList: [] },
        });
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

    it("GET_SCANNING_QUEUE 默认只读 Pinia，不 invoke scan_queue_get", async () => {
        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.GET_SCANNING_QUEUE,
            context: {},
            timestamp: Date.now(),
            source: "尉迟恭",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).not.toHaveBeenCalled();
        expect(result.acknowledged).toBe(true);
        expect((result.data as { queue: unknown[] }).queue).toEqual([]);
    });

    it("GET_SCANNING_QUEUE restoreFromDisk 时 invoke scan_queue_get", async () => {
        mockInvoke.mockResolvedValue([{ path: "/restored", action: "scan", timestamp: 1 }]);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.GET_SCANNING_QUEUE,
            context: { [SCAN_QUEUE_RESTORE_FROM_DISK]: true },
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

        expect(mockInvoke).toHaveBeenCalledWith(MENU_COMMANDS.APPLY, { menus });
        expect(result.acknowledged).toBe(true);
    });

    it("UPDATE_MENU with key invokes update_menu_item（RFC 0169）", async () => {
        mockInvoke.mockResolvedValue(undefined);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.UPDATE_MENU,
            context: { key: "file-import", disabled: true },
            timestamp: Date.now(),
            source: "长孙无忌",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith(MENU_COMMANDS.UPDATE_ITEM, {
            key: "file-import",
            disabled: true,
            label: undefined,
        });
        expect(result.acknowledged).toBe(true);
    });

    it("WINDOW_MAXIMIZE_TOGGLE toggles maximize state（RFC 0169）", async () => {
        mockInvoke.mockImplementation((cmd: string) => {
            if (cmd === "is_maximized") return Promise.resolve(false);
            return Promise.resolve(undefined);
        });

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.WINDOW_MAXIMIZE_TOGGLE,
            context: {},
            timestamp: Date.now(),
            source: "长孙无忌",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith("is_maximized");
        expect(mockInvoke).toHaveBeenCalledWith("maximize_window");
        expect(result.acknowledged).toBe(true);
    });

    it("WINDOW_CLOSE invokes close_window（RFC 0169）", async () => {
        mockInvoke.mockResolvedValue(undefined);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.WINDOW_CLOSE,
            context: {},
            timestamp: Date.now(),
            source: "长孙无忌",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith("close_window");
        expect(result.acknowledged).toBe(true);
    });

    it("WINDOW_MINIMIZE invokes minimize_window（RFC 0169）", async () => {
        mockInvoke.mockResolvedValue(undefined);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.WINDOW_MINIMIZE,
            context: {},
            timestamp: Date.now(),
            source: "长孙无忌",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith("minimize_window");
        expect(result.acknowledged).toBe(true);
    });

    it("STANDARD_EDIT_ACTION invokes dispatch_standard_edit_action", async () => {
        mockInvoke.mockResolvedValue(undefined);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.STANDARD_EDIT_ACTION,
            context: { action: "cut" },
            timestamp: Date.now(),
            source: "长孙无忌",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith("dispatch_standard_edit_action", {
            action: "cut",
        });
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

    it("SWITCH_FOLDER invoke get_photasa_config（RFC 0137/0139）", async () => {
        const config = { version: "1", photoList: [] };
        mockInvoke.mockResolvedValue(config);

        const result = await service.executeZhaoling({
            command: ZOUZHE_MATTERS.SWITCH_FOLDER,
            context: { folderPath: "/Volumes/photos" },
            timestamp: Date.now(),
            source: "魏征",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(mockInvoke).toHaveBeenCalledWith("get_photasa_config", {
            folder: "/Volumes/photos",
        });
        expect(result.acknowledged).toBe(true);
        expect(result.data).toEqual({
            currentFolder: "/Volumes/photos",
            currentFolderConfig: config,
        });
    });

    it("未直连 matter 明确失败（RFC 0153 zouwu 已移除）", async () => {
        const result = await service.executeZhaoling({
            command: "retired_zouwu_matter",
            context: {},
            timestamp: Date.now(),
            source: "测试",
            priority: "normal",
            requiresTianshuApproval: true,
        });

        expect(result.acknowledged).toBe(false);
        expect(result.error).toContain("RFC 0153");
        expect(mockInvoke).not.toHaveBeenCalled();
    });
});
