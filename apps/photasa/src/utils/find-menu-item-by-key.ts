import type { MenuItemData } from "@photasa/common";

/** Walk SystemMenus tree and find item by stable menu key */
export function findMenuItemByKey(
    menus: readonly MenuItemData[],
    key: string,
): MenuItemData | undefined {
    for (const item of menus) {
        if (item.key === key) {
            return item;
        }

        if (item.items) {
            const nested = findMenuItemByKey(item.items, key);
            if (nested) {
                return nested;
            }
        }
    }

    return undefined;
}
