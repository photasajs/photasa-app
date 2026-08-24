import type { DirectorySelection } from "@photasa/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import { GUANYUAN_NAMES, ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";
import { ZhangSunWuJiService } from "../zhangsunwuji";
import {
    MENU_KEY_APP_PREFERENCES,
    MENU_KEY_FILE_IMPORT,
    MENU_KEY_HELP_ABOUT,
    MENU_KEY_HELP_EXPLORE,
    MENU_KEY_HELP_GETTING_STARTED,
    MENU_KEY_HELP_REPORT_ISSUE,
    MENU_KEY_VIEW_RELOAD,
    MENU_KEY_WINDOW_CLOSE,
} from "@renderer/constants/menu-keys";
import { PHOTASA_ME_DOCS_URL, PHOTASA_ME_HOMEPAGE_URL } from "@renderer/constants/photasa-me-api";
import { QizouMatters } from "@renderer/constants/qizou-shengzhi-commands";
import { openReportIssueDialog } from "../../report-issue-dialog";
import {
    openAboutFromMenu,
    openImportPhotosFromMenu,
    openPreferenceFromMenu,
} from "../../menu-app-handlers";

vi.mock("../../report-issue-dialog", () => ({
    openReportIssueDialog: vi.fn(),
}));

vi.mock("../../menu-app-handlers", () => ({
    openPreferenceFromMenu: vi.fn(),
    openAboutFromMenu: vi.fn(),
    openImportPhotosFromMenu: vi.fn(),
    openScanListFromMenu: vi.fn(),
    addLibraryFolderFromMenu: vi.fn(),
}));

describe("ZhangSunWuJiService directory selection (RFC 0154 Phase 2f)", () => {
    const processZouzhe = vi.fn();
    const qizouEmit = vi.fn();
    const fangXuanLing = {
        processZouzhe,
        menus: { menus: [] },
    } as unknown as IFangXuanLingService;

    function createService(): ZhangSunWuJiService {
        const service = new ZhangSunWuJiService(fangXuanLing);
        service.setQizouBus({ emit: qizouEmit } as never);
        return service;
    }

    beforeEach(() => vi.clearAllMocks());

    it("submits one directory-dialog memorial and returns its approved paths", async () => {
        const selection: DirectorySelection = { filePaths: ["/photos/a", "/photos/b"] };
        processZouzhe.mockResolvedValue({
            approved: true,
            matter: ZOUZHE_MATTERS.CHOOSE_DIRECTORIES,
            data: selection,
            instruction: "目录选择成功",
            timestamp: 1,
        });
        const service = new ZhangSunWuJiService(fangXuanLing);

        await expect(service.chooseDirectories(true)).resolves.toEqual(selection);
        expect(processZouzhe).toHaveBeenCalledWith(
            expect.objectContaining({
                department: GUANYUAN_NAMES.ZHANG_SUN_WU_JI,
                matter: ZOUZHE_MATTERS.CHOOSE_DIRECTORIES,
                content: { multiple: true },
                priority: "normal",
            }),
        );
    });

    it("rejects a denied directory-dialog memorial", async () => {
        processZouzhe.mockResolvedValue({
            approved: false,
            matter: ZOUZHE_MATTERS.CHOOSE_DIRECTORIES,
            data: null,
            instruction: "目录选择失败",
            timestamp: 1,
        });
        const service = new ZhangSunWuJiService(fangXuanLing);

        await expect(service.chooseDirectories(false)).rejects.toThrow("目录选择失败");
    });

    it("routes reload menu actions through FangXuanLing instead of window.api", async () => {
        processZouzhe.mockResolvedValue({
            approved: true,
            matter: "reload_window",
            data: null,
            instruction: "窗口重载成功",
            timestamp: 1,
        });
        const service = new ZhangSunWuJiService(fangXuanLing);

        service.handleMenuAction({ key: MENU_KEY_VIEW_RELOAD, label: "Reload" });

        await vi.waitFor(() =>
            expect(processZouzhe).toHaveBeenCalledWith(
                expect.objectContaining({
                    matter: "reload_window",
                    content: {},
                }),
            ),
        );
    });

    it("opens report issue dialog for help-report-issue menu key", () => {
        const service = new ZhangSunWuJiService(fangXuanLing);

        service.handleMenuAction({ key: MENU_KEY_HELP_REPORT_ISSUE, label: "Report Issue" });

        expect(openReportIssueDialog).toHaveBeenCalledTimes(1);
        expect(processZouzhe).not.toHaveBeenCalled();
    });

    it("does not treat help-report-issue as external url even if payload carries url", () => {
        const service = new ZhangSunWuJiService(fangXuanLing);

        service.handleMenuAction({
            key: MENU_KEY_HELP_REPORT_ISSUE,
            label: "Report Issue",
            url: "https://evil.example",
        });

        expect(openReportIssueDialog).toHaveBeenCalledTimes(1);
        expect(processZouzhe).not.toHaveBeenCalled();
    });

    it("routes RFC 0169 app/file menu keys to registered handlers", () => {
        const service = new ZhangSunWuJiService(fangXuanLing);

        service.handleMenuAction({ key: MENU_KEY_APP_PREFERENCES, label: "Preferences" });
        service.handleMenuAction({ key: MENU_KEY_FILE_IMPORT, label: "Import" });

        expect(openPreferenceFromMenu).toHaveBeenCalledTimes(1);
        expect(openImportPhotosFromMenu).toHaveBeenCalledTimes(1);
    });

    it("routes window-close through FangXuanLing zouzhe（RFC 0169）", async () => {
        processZouzhe.mockResolvedValue({
            approved: true,
            matter: ZOUZHE_MATTERS.WINDOW_CLOSE,
            data: null,
            instruction: "窗口已关闭",
            timestamp: 1,
        });
        const service = new ZhangSunWuJiService(fangXuanLing);

        service.handleMenuAction({ key: MENU_KEY_WINDOW_CLOSE, label: "Close" });

        await vi.waitFor(() =>
            expect(processZouzhe).toHaveBeenCalledWith(
                expect.objectContaining({
                    matter: ZOUZHE_MATTERS.WINDOW_CLOSE,
                    content: {},
                }),
            ),
        );
    });

    it("opens about tab for help-about menu key (F1)", () => {
        const service = createService();

        service.handleMenuAction({ key: MENU_KEY_HELP_ABOUT, label: "About" });

        expect(openAboutFromMenu).toHaveBeenCalledTimes(1);
        expect(processZouzhe).not.toHaveBeenCalled();
    });

    it("opens external links for RFC 0171 help explore and getting started keys", () => {
        const service = createService();

        service.handleMenuAction({
            key: MENU_KEY_HELP_EXPLORE,
            label: "Explore Photasa",
            url: PHOTASA_ME_HOMEPAGE_URL,
        });
        service.handleMenuAction({
            key: MENU_KEY_HELP_GETTING_STARTED,
            label: "Getting Started with Photasa",
            url: PHOTASA_ME_DOCS_URL,
        });

        expect(qizouEmit).toHaveBeenCalledTimes(2);
        expect(qizouEmit).toHaveBeenNthCalledWith(
            1,
            "qizou",
            expect.objectContaining({
                matter: QizouMatters.OPEN_EXTERNAL,
                content: { url: PHOTASA_ME_HOMEPAGE_URL },
            }),
        );
        expect(qizouEmit).toHaveBeenNthCalledWith(
            2,
            "qizou",
            expect.objectContaining({
                matter: QizouMatters.OPEN_EXTERNAL,
                content: { url: PHOTASA_ME_DOCS_URL },
            }),
        );
    });
});
