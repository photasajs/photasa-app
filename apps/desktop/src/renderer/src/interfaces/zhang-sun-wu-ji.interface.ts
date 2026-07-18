/**
 * 长孙无忌服务接口
 * RFC 0058: 统一菜单管理到 qizou 流程
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

import type { InjectionKey } from "vue";
import type { Emitter } from "mitt";
import type { MenuItemData } from "@photasa/common";
import type { Qizou } from "@renderer/interfaces/qizou.interface";

/**
 * 菜单点击事件载荷
 * 由主进程菜单点击事件触发，通过 qizou-shengzhi 流程传递
 */
export interface MenuActionPayload {
    /** 菜单项唯一标识 */
    key: string;
    /** 菜单项显示标签 */
    label: string;
    /** 快捷键（如果有） */
    shortcut?: string;
    /** Electron role（如果有） */
    role?: string;
    /** 自定义 URL（如果有，如 help.learnMore） */
    url?: string;
}

/**
 * 长孙无忌服务接口
 * 负责菜单的 UI 管理和同步
 *
 * 架构原则：
 * - ❌ 长孙无忌不持有响应式状态
 * - ❌ UI 组件不能直接访问 `menusStore`（违反服务模式）
 * - ✅ 菜单数据存储在 `menusStore`（Pinia Store，作为响应式状态容器）
 * - ✅ 长孙无忌通过房玄龄的 Accessor 访问 `menusStore`（只读）
 * - ✅ 长孙无忌通过 zouzhe 更新 `menusStore`（通过房玄龄）
 * - ✅ UI 组件必须通过 `useZhangSunWuJi()` 访问菜单数据（服务接口）
 *
 * **为什么需要 `menusStore`？**
 * 1. **响应式需求**：Vue 组件需要响应式菜单数据，Store 提供响应式状态管理
 * 2. **跨组件共享**：多个组件需要访问菜单数据，Store 作为单一数据源（SSOT）
 * 3. **运行时状态**：菜单数据是运行时状态，不需要持久化，但需要响应式更新
 * 4. **符合 Accessor 模式**：遵循 RFC 0043 的 Accessor 模式，Store 作为响应式状态容器，服务通过房玄龄访问
 * 5. **架构一致性**：所有状态访问都通过服务层，保持架构一致性
 */
export interface IZhangSunWuJiService {
    /**
     * 服务名称（IService 接口要求）
     */
    readonly name: string;

    /**
     * 当前菜单数据（只读）
     * 长孙无忌通过房玄龄访问 menusStore.menus
     *
     * @example
     * const zhangSunWuJi = useZhangSunWuJi();
     * const menus = zhangSunWuJi.menus;  // MenuItemData[]
     */
    readonly menus: MenuItemData[];

    /**
     * 刷新菜单（国际化）
     * 当语言切换时调用，更新菜单的 label
     *
     * @param t 国际化翻译函数
     * @example
     * const zhangSunWuJi = useZhangSunWuJi();
     * zhangSunWuJi.refreshMenus(t);
     */
    refreshMenus(t: (key: string) => string): void;

    /**
     * 设置菜单项禁用状态
     *
     * @param key 菜单项唯一标识
     * @param disabled 是否禁用
     * @example
     * const zhangSunWuJi = useZhangSunWuJi();
     * zhangSunWuJi.setMenuDisabled("file.new", true);
     */
    setMenuDisabled(key: string, disabled: boolean): void;

    /**
     * 处理菜单点击事件
     * 由主进程菜单点击事件触发（通过 qizou-shengzhi）
     *
     * @param payload 菜单点击事件载荷
     * @example
     * // 由李世民路由调用
     * zhangSunWuJi.handleMenuAction({
     *     key: "help.learnMore",
     *     label: "Learn More",
     *     url: "https://example.com"
     * });
     */
    handleMenuAction(payload: MenuActionPayload): void;

    /**
     * 打开外部链接
     * 通过 qizou 流程，由袁天罡发送 IPC 到主进程执行
     *
     * @param url 外部链接 URL
     * @example
     * const zhangSunWuJi = useZhangSunWuJi();
     * zhangSunWuJi.openExternal("https://example.com");
     */
    openExternal(url: string): void;

    /**
     * 在 Finder 中显示文件
     * 通过 qizou 流程，由袁天罡发送 IPC 到主进程执行
     *
     * @param path 文件路径
     * @example
     * const zhangSunWuJi = useZhangSunWuJi();
     * zhangSunWuJi.openInFinder("/path/to/file");
     */
    openInFinder(path: string): void;

    /**
     * 设置启奏事件总线
     * 用于向李世民发送 qizou 启奏（如菜单更新完成汇报）
     *
     * @param qizouBus mitt事件总线，用于发送qizou启奏
     */
    setQizouBus(qizouBus: Emitter<{ qizou: Qizou }>): void;
}

/**
 * 长孙无忌服务注入 Token
 * 用于 Vue 依赖注入
 */
export const ZHANG_SUN_WU_JI_TOKEN: InjectionKey<IZhangSunWuJiService> = Symbol("长孙无忌");
