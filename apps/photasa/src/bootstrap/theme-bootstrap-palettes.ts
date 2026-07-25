import { DEFAULT_THEME_ID, THEME_IDS, type BuiltInThemeId } from "@renderer/constants/theme-ids";

export interface ThemeBootstrapPalette {
    bg: string;
    text: string;
    primary: string;
    primaryRgb: string;
    colorScheme: "light" | "dark";
}

/** 首屏 bootstrap 最小色板（与 theme.json 的 bg/text/primary 对齐） */
export const THEME_BOOTSTRAP_PALETTES: Record<BuiltInThemeId, ThemeBootstrapPalette> = {
    [THEME_IDS.DARK]: {
        bg: "#1e1e1e",
        text: "#d4d4d4",
        primary: "#3794ff",
        primaryRgb: "55, 148, 255",
        colorScheme: "dark",
    },
    [THEME_IDS.LIGHT]: {
        bg: "#ffffff",
        text: "#1e1e1e",
        primary: "#0066b8",
        primaryRgb: "0, 102, 184",
        colorScheme: "light",
    },
    [THEME_IDS.SOLARIZED_DARK]: {
        bg: "#002b36",
        text: "#839496",
        primary: "#268bd2",
        primaryRgb: "38, 139, 210",
        colorScheme: "dark",
    },
    [THEME_IDS.SOLARIZED_LIGHT]: {
        bg: "#fdf6e3",
        text: "#657b83",
        primary: "#268bd2",
        primaryRgb: "38, 139, 210",
        colorScheme: "light",
    },
};

export function resolveBootstrapPalette(themeId: string | undefined): ThemeBootstrapPalette {
    const palette = THEME_BOOTSTRAP_PALETTES[themeId as BuiltInThemeId];
    return palette ?? THEME_BOOTSTRAP_PALETTES[DEFAULT_THEME_ID];
}
