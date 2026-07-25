import { describe, expect, it } from "vitest";
import darkTheme from "@renderer/themes/dark/theme.json";
import lightTheme from "@renderer/themes/light/theme.json";
import solarizedDarkTheme from "@renderer/themes/solarized-dark/theme.json";
import solarizedLightTheme from "@renderer/themes/solarized-light/theme.json";
import { BUILT_IN_THEME_IDS, THEME_STYLESHEETS } from "../theme-styles";

const BUILT_IN_THEMES = [lightTheme, darkTheme, solarizedLightTheme, solarizedDarkTheme];

describe("theme-styles", () => {
    it("embeds inline CSS for every built-in theme id", () => {
        for (const theme of BUILT_IN_THEMES) {
            expect(theme.id in THEME_STYLESHEETS).toBe(true);
            const css = THEME_STYLESHEETS[theme.id];
            expect(css).toBeTruthy();
            expect(css).toContain("--color-tree-bg");
            expect(css).not.toContain("/src/themes/");
        }
    });

    it("exports stable built-in theme id list", () => {
        expect([...BUILT_IN_THEME_IDS].sort()).toEqual(
            BUILT_IN_THEMES.map((theme) => theme.id).sort(),
        );
    });
});
