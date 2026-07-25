import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeManager } from "../theme-manage";
import { THEME_STYLESHEETS } from "../theme-styles";

describe("ThemeManager.applyTheme", () => {
    let manager: ThemeManager;

    beforeEach(async () => {
        manager = ThemeManager.getInstance();
        await manager.loadBuiltInThemes();
        document.documentElement.removeAttribute("data-theme");
        document.getElementById("theme-style")?.remove();
    });

    afterEach(() => {
        document.documentElement.removeAttribute("data-theme");
        document.getElementById("theme-style")?.remove();
    });

    it("injects bundled theme CSS synchronously (no runtime asset URL)", async () => {
        await manager.applyTheme("dark");

        const styleEl = document.getElementById("theme-style");
        expect(styleEl?.tagName).toBe("STYLE");
        expect(styleEl?.textContent).toBe(THEME_STYLESHEETS.dark);
        expect(styleEl?.textContent).toContain("--color-tree-bg");
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
});
