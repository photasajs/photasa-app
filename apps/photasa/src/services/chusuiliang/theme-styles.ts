/**
 * Bundled theme CSS — Vite `?raw` embeds rules in the JS bundle.
 * No runtime URL fetch: safe for Tauri production (no /src/themes, no /assets link race).
 */
import darkCss from "@renderer/themes/dark/theme.css?raw";
import lightCss from "@renderer/themes/light/theme.css?raw";
import solarizedDarkCss from "@renderer/themes/solarized-dark/theme.css?raw";
import solarizedLightCss from "@renderer/themes/solarized-light/theme.css?raw";

export const THEME_STYLESHEETS: Readonly<Record<string, string>> = {
    dark: darkCss,
    light: lightCss,
    "solarized-dark": solarizedDarkCss,
    "solarized-light": solarizedLightCss,
};

export const BUILT_IN_THEME_IDS = Object.freeze(
    Object.keys(THEME_STYLESHEETS),
) as readonly string[];
