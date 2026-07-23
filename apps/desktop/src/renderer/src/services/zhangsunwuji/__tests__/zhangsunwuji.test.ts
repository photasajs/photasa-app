/**
 * 长孙无忌（ZhangSunWuJi）单元测试
 * RFC 0058: 统一菜单管理到 qizou 流程
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import mitt from "mitt";
import { ZhangSunWuJiService } from "../zhangsunwuji";
import type {
    IFangXuanLingService,
    IMenus,
    Zouzhe,
    ZouzheResponse,
} from "@renderer/interfaces/fang-xuan-ling.interface";
import { ZOUZHE_MATTERS, GUANYUAN_NAMES } from "@renderer/interfaces/fang-xuan-ling.interface";
import type { Qizou } from "@renderer/interfaces/qizou.interface";
import type { MenuItemData } from "@photasa/common";
import { QizouMatters } from "@renderer/constants/qizou-shengzhi-commands";

const SAMPLE_MENUS: MenuItemData[] = [
    { key: "file", label: "menu.file", items: [] },
    {
        key: "help",
        label: "menu.help",
        items: [{ key: "help.learnMore", label: "menu.learnMore", url: "https://example.com" }],
    },
];

class MockMenusAccessor implements IMenus {
    private _menus: MenuItemData[] = [...SAMPLE_MENUS];

    get menus(): MenuItemData[] {
        return JSON.parse(JSON.stringify(this._menus));
    }

    refreshMenus(t: (key: string) => string): void {
        this._menus = this._menus.map((menu) => ({
            ...menu,
            label: t(menu.label),
        }));
    }

    setMenuDisabled(key: string, disabled: boolean): void {
        const updateItems = (items: MenuItemData[]): MenuItemData[] =>
            items.map((item) => {
                if (item.key === key) {
                    return { ...item, disabled };
                }
                if (item.items) {
                    return { ...item, items: updateItems(item.items) };
                }
                return item;
            });

        this._menus = updateItems(this._menus);
    }

    reset(): void {
        this._menus = [...SAMPLE_MENUS];
    }
}

class MockFangXuanLingService implements IFangXuanLingService {
    readonly receivedZouzhes: Zouzhe[] = [];
    private readonly mockMenus = new MockMenusAccessor();

    get menus(): IMenus {
        return this.mockMenus;
    }

    get preference(): never {
        throw new Error("Mock: preference not implemented");
    }

    get notification(): never {
        throw new Error("Mock: notification not implemented");
    }

    get photos(): never {
        throw new Error("Mock: photos not implemented");
    }

    get scanning(): never {
        throw new Error("Mock: scanning not implemented");
    }

    get statusBar(): never {
        throw new Error("Mock: statusBar not implemented");
    }

    get appState(): never {
        throw new Error("Mock: appState not implemented");
    }

    resetAll(): void {
        this.receivedZouzhes.length = 0;
        this.mockMenus.reset();
    }

    async processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse> {
        this.receivedZouzhes.push(zouzhe);
        return {
            approved: true,
            matter: zouzhe.matter,
            data: { persisted: true },
            instruction: "已批准",
            timestamp: Date.now(),
        };
    }
}

describe("📋 长孙无忌（ZhangSunWuJi）菜单管理服务", () => {
    let service: ZhangSunWuJiService;
    let mockFangXuanLing: MockFangXuanLingService;
    let emittedQizous: Qizou[];

    beforeEach(() => {
        mockFangXuanLing = new MockFangXuanLingService();
        service = new ZhangSunWuJiService(mockFangXuanLing);

        emittedQizous = [];
        const qizouBus = mitt<{ qizou: Qizou }>();
        qizouBus.on("qizou", (qizou) => {
            emittedQizous.push(qizou);
        });
        service.setQizouBus(qizouBus);
    });

    it("应通过房玄龄访问菜单数据", () => {
        expect(service.menus).toHaveLength(2);
        expect(service.menus[0]?.key).toBe("file");
    });

    it("refreshMenus 应更新菜单并发送 UPDATE_MENU zouzhe", () => {
        const t = (key: string) => `translated:${key}`;

        service.refreshMenus(t);

        expect(mockFangXuanLing.menus.menus[0]?.label).toBe("translated:menu.file");
        expect(mockFangXuanLing.receivedZouzhes).toHaveLength(1);

        const zouzhe = mockFangXuanLing.receivedZouzhes[0];
        expect(zouzhe?.matter).toBe(ZOUZHE_MATTERS.UPDATE_MENU);
        expect(zouzhe?.department).toBe(GUANYUAN_NAMES.ZHANG_SUN_WU_JI);
        expect(zouzhe?.content).toMatchObject({ menus: expect.any(Array) });
    });

    it("setMenuDisabled 应更新状态并发送 UPDATE_MENU zouzhe", () => {
        service.setMenuDisabled("file", true);

        expect(mockFangXuanLing.menus.menus[0]?.disabled).toBe(true);
        expect(mockFangXuanLing.receivedZouzhes[0]?.matter).toBe(ZOUZHE_MATTERS.UPDATE_MENU);
    });

    it("handleMenuAction 遇到 role 时不发送 qizou", () => {
        service.handleMenuAction({
            key: "view.reload",
            label: "Reload",
            role: "reload",
        });

        expect(emittedQizous).toHaveLength(0);
    });

    it("handleMenuAction 遇到 url 时应发送 OPEN_EXTERNAL qizou", () => {
        service.handleMenuAction({
            key: "help.learnMore",
            label: "Learn More",
            url: "https://example.com",
        });

        expect(emittedQizous).toHaveLength(1);
        expect(emittedQizous[0]?.matter).toBe(QizouMatters.OPEN_EXTERNAL);
        expect(emittedQizous[0]?.content).toEqual({ url: "https://example.com" });
    });

    it("openInFinder 应规范化路径并发送 OPEN_IN_FINDER qizou", () => {
        const normalizePath = vi.fn((_filePath: string) => "/normalized/path.jpg");
        window.api = {
            ...window.api,
            normalizePath,
        };

        service.openInFinder("file:///tmp/path.jpg");

        expect(normalizePath).toHaveBeenCalledWith("file:///tmp/path.jpg");
        expect(emittedQizous).toHaveLength(1);
        expect(emittedQizous[0]?.matter).toBe(QizouMatters.OPEN_IN_FINDER);
        expect(emittedQizous[0]?.content).toEqual({ path: "/normalized/path.jpg" });
    });
});
