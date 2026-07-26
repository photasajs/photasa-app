import { describe, expect, it } from "vitest";
import { SystemMenus } from "@renderer/components/common/menu-data";
import { MENU_KEY_HELP_REPORT_ISSUE } from "@renderer/constants/menu-keys";
import { findMenuItemByKey } from "../find-menu-item-by-key";

describe("findMenuItemByKey", () => {
    it("finds nested help menu items", () => {
        const item = findMenuItemByKey(SystemMenus, MENU_KEY_HELP_REPORT_ISSUE);

        expect(item?.label).toBe("menu.help.reportIssue");
        // Report Issue 必须无 role/url，走 handleMenuAction 显式分支（RFC 0169 / 0135）
        expect(item?.role).toBeUndefined();
        expect(item?.url).toBeUndefined();
    });

    it("returns undefined for unknown keys", () => {
        expect(findMenuItemByKey(SystemMenus, "missing-key")).toBeUndefined();
    });
});
