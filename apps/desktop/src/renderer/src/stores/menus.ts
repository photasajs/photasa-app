import { defineStore } from "pinia";
import { SystemMenus } from "@renderer/components/common/menu-data";
import type { MenuItemData } from "@common/menu-types";

// 递归深拷贝 SystemMenus，并将 label 国际化
function cloneMenus(menus: readonly MenuItemData[], t: (key: string) => string): MenuItemData[] {
    return menus.map((menu) => ({
        ...menu,
        label: t(menu.label),
        items: menu.items ? cloneMenus(menu.items, t) : undefined,
    }));
}

export const useMenusStore = defineStore("menus", {
    state: () => ({
        menus: [] as MenuItemData[],
    }),
    actions: {
        // 初始化或刷新菜单，label 通过 t 国际化
        refreshMenus(t: (key: string) => string) {
            this.menus = cloneMenus(SystemMenus, t);
        },
        // 根据 key 设置菜单项的 disabled 状态
        setMenuDisabled(key: string, disabled: boolean) {
            function update(items: MenuItemData[]) {
                for (const item of items) {
                    if (item.key === key) {
                        item.disabled = disabled;
                        return true;
                    }
                    if (item.items && update(item.items)) return true;
                }
                return false;
            }
            update(this.menus);
        },
        // 可扩展更多状态变更方法
    },
    // 不做 persist，运行时状态管理
});
