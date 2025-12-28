/**
 * 长孙无忌服务 Composable
 * RFC 0058: 提供菜单管理的响应式状态和方法
 *
 * 架构原则：
 * - UI 通过 useZhangSunWuJi() → 长孙无忌 → 房玄龄 → menusStore
 * - 长孙无忌管理菜单状态（通过房玄龄访问 menusStore）
 */

import { computed, inject } from "vue";
import {
    IZhangSunWuJiService,
    ZHANG_SUN_WU_JI_TOKEN,
    type MenuActionPayload,
} from "@renderer/interfaces/zhang-sun-wu-ji.interface";
import type { MenuItemData } from "@photasa/common";

/**
 * 长孙无忌服务 Composable
 * 提供菜单数据的访问和操作方法
 *
 * @example
 * ```typescript
 * const zhangSunWuJi = useZhangSunWuJi();
 * const menus = zhangSunWuJi.menus;  // ComputedRef<MenuItemData[]>
 * zhangSunWuJi.refreshMenus(t);
 * ```
 */
export function useZhangSunWuJi() {
    const zhangSunWuJiService = inject<IZhangSunWuJiService>(ZHANG_SUN_WU_JI_TOKEN);

    if (!zhangSunWuJiService) {
        // 服务未注入时返回默认值（防御性编程）
        return {
            menus: computed(() => [] as MenuItemData[]),
            refreshMenus: () => {
                // No-op if service is not available
            },
            setMenuDisabled: () => {
                // No-op if service is not available
            },
            handleMenuAction: () => {
                // No-op if service is not available
            },
            openExternal: () => {
                // No-op if service is not available
            },
            openInFinder: () => {
                // No-op if service is not available
            },
        };
    }

    /**
     * 当前菜单数据（响应式）
     * 通过长孙无忌服务访问，服务内部通过房玄龄访问 menusStore
     */
    const menus = computed(() => zhangSunWuJiService.menus);

    /**
     * 刷新菜单（国际化）
     * 当语言切换时调用，更新菜单的 label
     */
    const refreshMenus = (t: (key: string) => string) => {
        zhangSunWuJiService.refreshMenus(t);
    };

    /**
     * 设置菜单项禁用状态
     */
    const setMenuDisabled = (key: string, disabled: boolean) => {
        zhangSunWuJiService.setMenuDisabled(key, disabled);
    };

    /**
     * 处理菜单点击事件
     * 由主进程菜单点击事件触发（通过 qizou-shengzhi）
     */
    const handleMenuAction = (payload: MenuActionPayload) => {
        zhangSunWuJiService.handleMenuAction(payload);
    };

    /**
     * 打开外部链接
     * 通过长孙无忌服务发送 qizou
     */
    const openExternal = (url: string) => {
        zhangSunWuJiService.openExternal(url);
    };

    /**
     * 在 Finder 中显示文件
     * 通过长孙无忌服务发送 qizou
     */
    const openInFinder = (path: string) => {
        zhangSunWuJiService.openInFinder(path);
    };

    return {
        menus,
        refreshMenus,
        setMenuDisabled,
        handleMenuAction,
        openExternal,
        openInFinder,
    };
}
