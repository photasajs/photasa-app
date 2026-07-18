/**
 * 长孙无忌（ZhangSunWuJi）- 菜单管理服务
 * RFC 0058: 统一菜单管理到 qizou 流程
 *
 * 职责：
 * 1. 管理菜单的 UI 状态（通过房玄龄访问 menusStore）
 * 2. 同步菜单数据到主进程（通过 zouzhe + 天枢引擎）
 * 3. 处理菜单点击事件（通过 qizou-shengzhi）
 *
 * 架构原则：
 * - ❌ 长孙无忌不持有响应式状态
 * - ❌ UI 组件不能直接访问 `menusStore`（违反服务模式）
 * - ✅ 菜单数据存储在 `menusStore`（Pinia Store，作为响应式状态容器）
 * - ✅ 长孙无忌通过房玄龄的 Accessor 访问 `menusStore`（只读）
 * - ✅ 长孙无忌通过 zouzhe 更新 `menusStore`（通过房玄龄）
 * - ✅ UI 组件必须通过 `useZhangSunWuJi()` 访问菜单数据（服务接口）
 *
 * 历史背景：
 * 长孙无忌（ZhangSunWuJi，字辅机，594-659年）：
 * - 唐朝著名政治家、开国功臣
 * - 贞观年间官至司空，负责朝廷礼仪和接待
 * - 以"礼仪严谨"著称，精通朝廷礼仪规范
 * - 主持编纂《唐律疏议》，负责规范制定
 *
 * 在架构中的职责（符合历史角色）：
 * - 作为"礼仪官"，负责菜单的规范管理
 * - 同步菜单数据到主进程（通过 qizou-shengzhi）
 * - 处理菜单点击事件（通过 qizou-shengzhi）
 * - 职责单一：只负责菜单 UI 层，不参与业务逻辑
 */

import type {
    IZhangSunWuJiService,
    MenuActionPayload,
} from "@renderer/interfaces/zhang-sun-wu-ji.interface";
import { MENU_KEY_VIEW_FORCE_RELOAD, MENU_KEY_VIEW_RELOAD } from "../../constants/menu-keys";
import type { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import {
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
    GUANYUAN_NAMES,
    type Zouzhe,
} from "@renderer/interfaces/fang-xuan-ling.interface";
import type { MenuItemData } from "@photasa/common";
import type { Shengzhi } from "@renderer/interfaces/shengzhi.interface";
import type { Qizou } from "@renderer/interfaces/qizou.interface";
import type { Emitter } from "mitt";
import { IService } from "@renderer/interfaces/service.interface";
import { QizouMatters } from "@renderer/constants/qizou-shengzhi-commands";
import { loggers } from "@photasa/common";

const logger = loggers.zhangsunwuji;

/**
 * 长孙无忌服务实现
 * RFC 0058: 统一菜单管理到 qizou 流程
 */
export class ZhangSunWuJiService implements IService, IZhangSunWuJiService {
    /**
     * 房玄龄宰相服务（用于访问 menusStore 和处理 zouzhe）
     * Phase 3 中会使用此服务访问 menus Accessor 和发送 zouzhe
     */
    private readonly fangXuanLingService: IFangXuanLingService;
    /** 圣旨接收通道 */
    private shengzhiPort?: MessagePort;
    /** 启奏事件总线（用于发送 qizou 启奏） */
    private qizouBus?: Emitter<{ qizou: Qizou }>;

    constructor(fangXuanLingService: IFangXuanLingService) {
        if (!fangXuanLingService) {
            throw new Error("房玄龄宰相服务未注入");
        }
        this.fangXuanLingService = fangXuanLingService;
        logger.info("📋 长孙无忌就任司空，负责朝廷礼仪和菜单规范");
    }

    get name(): string {
        return "长孙无忌";
    }

    /**
     * 设置圣旨接收通道（IService 接口要求）
     * 由杜如晦调用，建立与李世民的通信通道
     */
    setShengzhiPort(port: MessagePort): void {
        this.shengzhiPort = port;
        this.shengzhiPort.onmessage = (event: MessageEvent) => {
            const shengzhi = event.data;
            this.processShengzhi(shengzhi);
        };
        logger.info("📋 长孙无忌建立圣旨接收通道");
    }

    /**
     * 处理圣旨（由 setShengzhiPort 中的 onmessage 调用）
     * Phase 4 中会实现菜单点击事件处理
     */
    private async processShengzhi(shengzhi: Shengzhi): Promise<void> {
        try {
            switch (shengzhi.command) {
                case "menu_action":
                    // Phase 4: 处理菜单点击事件
                    const payload = shengzhi.content as MenuActionPayload;
                    await this.handleMenuAction(payload);
                    break;
                default:
                    logger.warn(`📋 长孙无忌：未知圣旨命令 ${shengzhi.command}`);
            }
        } catch (error) {
            logger.error(`📋 长孙无忌：处理圣旨失败`, error);
        }
    }

    /**
     * 当前菜单数据（只读）
     * 长孙无忌通过房玄龄访问 menusStore.menus
     */
    get menus(): MenuItemData[] {
        return this.fangXuanLingService.menus.menus;
    }

    /**
     * 刷新菜单（国际化）
     * 当语言切换时调用，更新菜单的 label
     *
     * 流程：
     * 1. 更新 menusStore（通过房玄龄的 accessor）
     * 2. 发送 UPDATE_MENU zouzhe 到房玄龄（同步到主进程）
     */
    refreshMenus(t: (key: string) => string): void {
        logger.info("📋 长孙无忌：奉旨刷新菜单，更新国际化标签");

        // 1. 更新 menusStore（通过房玄龄的 accessor）
        this.fangXuanLingService.menus.refreshMenus(t);

        // 2. 发送 UPDATE_MENU zouzhe 到房玄龄
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.ZHANG_SUN_WU_JI,
            matter: ZOUZHE_MATTERS.UPDATE_MENU,
            content: {
                menus: this.fangXuanLingService.menus.menus,
            },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        this.fangXuanLingService.processZouzhe(zouzhe).catch((error) => {
            logger.error("📋 长孙无忌：发送 UPDATE_MENU zouzhe 失败", error);
        });
    }

    /**
     * 设置菜单项禁用状态
     *
     * 流程：
     * 1. 更新 menusStore（通过房玄龄的 accessor）
     * 2. 发送 UPDATE_MENU zouzhe 到房玄龄（同步到主进程）
     */
    setMenuDisabled(key: string, disabled: boolean): void {
        logger.info(`📋 长孙无忌：调整菜单项 ${key} 状态，${disabled ? "禁用" : "启用"}`);

        // 1. 更新 menusStore（通过房玄龄的 accessor）
        this.fangXuanLingService.menus.setMenuDisabled(key, disabled);

        // 2. 发送 UPDATE_MENU zouzhe 到房玄龄
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.ZHANG_SUN_WU_JI,
            matter: ZOUZHE_MATTERS.UPDATE_MENU,
            content: {
                menus: this.fangXuanLingService.menus.menus,
            },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        this.fangXuanLingService.processZouzhe(zouzhe).catch((error) => {
            logger.error("📋 长孙无忌：发送 UPDATE_MENU zouzhe 失败", error);
        });
    }

    /**
     * 设置启奏事件总线
     * 用于向李世民发送 qizou 启奏（如菜单更新完成汇报）
     *
     * @param qizouBus mitt事件总线，用于发送qizou启奏
     */
    setQizouBus(qizouBus: Emitter<{ qizou: Qizou }>): void {
        logger.info("📋 长孙无忌建立启奏通道，可向陛下汇报菜单事务");
        this.qizouBus = qizouBus;
    }

    /**
     * 处理菜单点击事件
     * 由主进程菜单点击事件触发（通过 qizou-shengzhi）
     *
     * 根据菜单项 key 分发到相应服务或处理：
     * - 有 role 的菜单项：由 Electron 自动处理（如 reload, quit, about 等）
     * - 有 url 的菜单项：打开外部链接（如 help.learnMore）
     * - 其他菜单项：根据 key 分发到相应服务或 emit 事件
     */
    handleMenuAction(payload: MenuActionPayload): void {
        logger.info(`📋 长孙无忌：收到菜单点击事件，处理 ${payload.key}`);

        try {
            // 0. 重新加载：Tauri 系统菜单仅回传 `key`（无 role），须在此显式 invoke（RFC 0099）
            if (
                payload.key === MENU_KEY_VIEW_RELOAD ||
                payload.key === MENU_KEY_VIEW_FORCE_RELOAD
            ) {
                void Promise.resolve(
                    (
                        window as { api?: { reloadWindow?: () => Promise<void> } }
                    ).api?.reloadWindow?.(),
                ).catch((err: unknown) => {
                    logger.error(`📋 长孙无忌：重新加载失败（${payload.key}）`, err);
                });
                return;
            }

            // 1. 有 role 的菜单项：由 Electron 自动处理，无需额外操作
            if (payload.role) {
                logger.debug(
                    `📋 长孙无忌：菜单项 ${payload.key} 有 role (${payload.role})，由 Electron 自动处理`,
                );
                return;
            }

            // 2. 有 url 的菜单项：打开外部链接（通过 qizou 流程）
            if (payload.url) {
                logger.info(`📋 长孙无忌：需打开外部链接 ${payload.url}，启奏袁天罡处理`);
                this.openExternal(payload.url);
                return;
            }

            // 3. 其他菜单项：根据 key 分发到相应服务或 emit 事件
            // 目前大部分菜单项都有 role 或 url，这里预留扩展点
            logger.warn(`📋 长孙无忌：菜单项 ${payload.key} 未实现处理逻辑`);
        } catch (error) {
            logger.error(`📋 长孙无忌：处理菜单点击事件失败 (${payload.key})`, error);
        }
    }

    /**
     * 打开外部链接
     * 通过 qizou 流程，由袁天罡发送 IPC 到主进程执行
     *
     * @param url 外部链接 URL
     */
    openExternal(url: string): void {
        if (!this.qizouBus) {
            logger.error("📋 长孙无忌：启奏通道未建立，无法发送启奏");
            return;
        }

        logger.info(`📋 长孙无忌：启奏打开外部链接 ${url}`);

        const qizou: Qizou = {
            matter: QizouMatters.OPEN_EXTERNAL,
            content: {
                url,
            },
            from: "长孙无忌",
            timestamp: Date.now(),
            metadata: {
                type: "request",
                priority: "normal",
            },
        };

        this.qizouBus.emit("qizou", qizou);
    }

    /**
     * 在 Finder 中显示文件
     * 通过 qizou 流程，由袁天罡发送 IPC 到主进程执行
     *
     * 架构原则：Electron 各层职责分工
     * - Renderer 层：关心 file:// URL（浏览器环境）
     * - Main 层：关心 OS 路径（Node.js 环境）
     * - 服务层：负责两者之间的转换
     *
     * 因此，此方法接收的 path 可能是 file:// URL 或普通路径，
     * 需要转换为 OS 路径后再发送到主进程。
     *
     * @param path 文件路径（可能是 file:// URL 或普通路径）
     */
    openInFinder(path: string): void {
        if (!this.qizouBus) {
            logger.error("📋 长孙无忌：启奏通道未建立，无法发送启奏");
            return;
        }

        // ✅ 在服务层统一处理 file:// URL 到 OS 路径的转换
        // 使用 window.api.normalizePath（来自 preload，调用 shared/path-util.ts）
        // 这样可以避免每个组件都重复转换逻辑
        const osPath = window.api.normalizePath?.(path) || path;

        logger.info(`📋 长孙无忌：启奏在 Finder 中显示文件 ${osPath}（原始路径：${path}）`);

        const qizou: Qizou = {
            matter: QizouMatters.OPEN_IN_FINDER,
            content: {
                path: osPath, // 发送 OS 路径到主进程
            },
            from: "长孙无忌",
            timestamp: Date.now(),
            metadata: {
                type: "request",
                priority: "normal",
            },
        };

        this.qizouBus.emit("qizou", qizou);
    }
}
