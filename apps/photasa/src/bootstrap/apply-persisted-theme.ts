import { DEFAULT_THEME_ID, PREFERENCE_STORE_STORAGE_KEY } from "@renderer/constants/theme-ids";
import { resolveBootstrapPalette, type ThemeBootstrapPalette } from "./theme-bootstrap-palettes";

interface PersistedPreferenceState {
    ui?: {
        theme?: string;
    };
}

export function readPersistedThemeId(storage: Storage = localStorage): string {
    try {
        const raw = storage.getItem(PREFERENCE_STORE_STORAGE_KEY);
        if (!raw) {
            return DEFAULT_THEME_ID;
        }
        const parsed = JSON.parse(raw) as PersistedPreferenceState;
        return parsed.ui?.theme || DEFAULT_THEME_ID;
    } catch {
        return DEFAULT_THEME_ID;
    }
}

export function applyThemeBootstrapPalette(
    themeId: string,
    root: HTMLElement = document.documentElement,
): ThemeBootstrapPalette {
    const palette = resolveBootstrapPalette(themeId);
    root.setAttribute("data-theme", themeId);
    root.style.setProperty("--color-bg", palette.bg);
    root.style.setProperty("--color-text", palette.text);
    root.style.setProperty("--color-primary", palette.primary);
    root.style.setProperty("--color-primary-rgb", palette.primaryRgb);
    root.style.backgroundColor = palette.bg;
    root.style.color = palette.text;
    root.style.colorScheme = palette.colorScheme;

    if (document.body) {
        document.body.style.backgroundColor = palette.bg;
        document.body.style.color = palette.text;
    }

    const appRoot = document.getElementById("app");
    if (appRoot) {
        appRoot.setAttribute("data-theme", themeId);
        appRoot.style.backgroundColor = palette.bg;
        appRoot.style.color = palette.text;
    }

    return palette;
}

/** 主窗首帧：从 localStorage 恢复主题，避免 Vite/main.ts 加载前的白屏 */
export function applyPersistedThemeBootstrap(): string {
    const themeId = readPersistedThemeId();
    applyThemeBootstrapPalette(themeId);
    return themeId;
}
