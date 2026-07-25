/**
 * 主窗首帧主题 bootstrap（阻塞脚本，须在 main.ts 之前执行）
 * 色板与 src/bootstrap/theme-bootstrap-palettes.ts 保持同步
 */
(function bootstrapMainWindowTheme() {
    const PREFERENCE_STORE_STORAGE_KEY = "preference";
    const DEFAULT_THEME_ID = "dark";

    const THEME_PALETTES = {
        dark: {
            bg: "#1e1e1e",
            text: "#d4d4d4",
            primary: "#3794ff",
            primaryRgb: "55, 148, 255",
            colorScheme: "dark",
        },
        light: {
            bg: "#ffffff",
            text: "#1e1e1e",
            primary: "#0066b8",
            primaryRgb: "0, 102, 184",
            colorScheme: "light",
        },
        "solarized-dark": {
            bg: "#002b36",
            text: "#839496",
            primary: "#268bd2",
            primaryRgb: "38, 139, 210",
            colorScheme: "dark",
        },
        "solarized-light": {
            bg: "#fdf6e3",
            text: "#657b83",
            primary: "#268bd2",
            primaryRgb: "38, 139, 210",
            colorScheme: "light",
        },
    };

    function readThemeId() {
        try {
            const raw = localStorage.getItem(PREFERENCE_STORE_STORAGE_KEY);
            if (!raw) {
                return DEFAULT_THEME_ID;
            }
            const parsed = JSON.parse(raw);
            return parsed?.ui?.theme || DEFAULT_THEME_ID;
        } catch {
            return DEFAULT_THEME_ID;
        }
    }

    function apply(themeId) {
        const palette = THEME_PALETTES[themeId] || THEME_PALETTES[DEFAULT_THEME_ID];
        const root = document.documentElement;
        root.setAttribute("data-theme", themeId);
        root.style.setProperty("--color-bg", palette.bg);
        root.style.setProperty("--color-text", palette.text);
        root.style.setProperty("--color-primary", palette.primary);
        root.style.setProperty("--color-primary-rgb", palette.primaryRgb);
        root.style.backgroundColor = palette.bg;
        root.style.color = palette.text;
        root.style.colorScheme = palette.colorScheme;
    }

    apply(readThemeId());

    document.addEventListener("DOMContentLoaded", function onDomReady() {
        const themeId = readThemeId();
        const palette = THEME_PALETTES[themeId] || THEME_PALETTES[DEFAULT_THEME_ID];
        document.body.style.backgroundColor = palette.bg;
        document.body.style.color = palette.text;
        const appRoot = document.getElementById("app");
        if (appRoot) {
            appRoot.setAttribute("data-theme", themeId);
            appRoot.style.backgroundColor = palette.bg;
            appRoot.style.color = palette.text;
        }
    });
})();
