import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
    applyPersistedThemeBootstrap,
    applyThemeBootstrapPalette,
    readPersistedThemeId,
} from "../apply-persisted-theme";
import { THEME_IDS } from "@renderer/constants/theme-ids";

describe("apply-persisted-theme", () => {
    let storage: Storage;

    beforeEach(() => {
        storage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            key: vi.fn(),
            length: 0,
        };
        document.documentElement.removeAttribute("data-theme");
        document.documentElement.removeAttribute("style");
    });

    afterEach(() => {
        document.documentElement.removeAttribute("data-theme");
        document.documentElement.removeAttribute("style");
    });

    it("reads theme id from persisted preference store", () => {
        vi.mocked(storage.getItem).mockReturnValue(
            JSON.stringify({ ui: { theme: THEME_IDS.SOLARIZED_DARK } }),
        );
        expect(readPersistedThemeId(storage)).toBe(THEME_IDS.SOLARIZED_DARK);
    });

    it("falls back to dark when storage is empty", () => {
        vi.mocked(storage.getItem).mockReturnValue(null);
        expect(readPersistedThemeId(storage)).toBe(THEME_IDS.DARK);
    });

    it("applies bootstrap palette to document root", () => {
        applyThemeBootstrapPalette(THEME_IDS.LIGHT);
        expect(document.documentElement.getAttribute("data-theme")).toBe(THEME_IDS.LIGHT);
        expect(document.documentElement.style.getPropertyValue("--color-bg")).toBe("#ffffff");
        expect(document.documentElement.style.getPropertyValue("--color-text")).toBe("#1e1e1e");
    });

    it("applyPersistedThemeBootstrap uses persisted theme", () => {
        vi.mocked(storage.getItem).mockReturnValue(
            JSON.stringify({ ui: { theme: THEME_IDS.DARK } }),
        );
        const originalGetItem = Storage.prototype.getItem;
        Storage.prototype.getItem = storage.getItem.bind(storage);

        const themeId = applyPersistedThemeBootstrap();
        expect(themeId).toBe(THEME_IDS.DARK);
        expect(document.documentElement.style.getPropertyValue("--color-bg")).toBe("#1e1e1e");

        Storage.prototype.getItem = originalGetItem;
    });
});
