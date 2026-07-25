/** 内置主题 id，与 src/themes 下 theme.json 一致 */
export const THEME_IDS = {
    LIGHT: "light",
    DARK: "dark",
    SOLARIZED_LIGHT: "solarized-light",
    SOLARIZED_DARK: "solarized-dark",
} as const;

export type BuiltInThemeId = (typeof THEME_IDS)[keyof typeof THEME_IDS];

export const DEFAULT_THEME_ID: BuiltInThemeId = THEME_IDS.DARK;

/** Pinia persist key for preference store */
export const PREFERENCE_STORE_STORAGE_KEY = "preference";
