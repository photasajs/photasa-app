import { ref } from "vue";
import lightTheme from "@renderer/themes/light/theme.json";
import darkTheme from "@renderer/themes/dark/theme.json";
import solarizedLightTheme from "@renderer/themes/solarized-light/theme.json";
import solarizedDarkTheme from "@renderer/themes/solarized-dark/theme.json";

export interface ThemeMeta {
    id: string;
    name: string;
    author: string;
    version: string;
    description: string;
    preview?: string;
    colors: Record<string, string>;
    css?: string;
}

class ThemeManager {
    private static _instance: ThemeManager;
    private themes = ref<ThemeMeta[]>([]);
    private currentThemeId = ref<string | null>(null);

    static getInstance() {
        if (!ThemeManager._instance) {
            ThemeManager._instance = new ThemeManager();
        }
        return ThemeManager._instance;
    }

    // 加载本地主题包
    async loadLocalThemes(themeDir: string): Promise<void> {
        // 伪代码：实际需用Node/Electron API读取目录和json
        // const themeFolders = await fs.readdir(themeDir);
        // for (const folder of themeFolders) {
        //   const meta = await fs.readJson(`${themeDir}/${folder}/theme.json`);
        //   this.themes.value.push({ ...meta, id: folder });
        // }
    }

    // 应用主题（仅注入CSS变量和样式）
    async applyTheme(themeId: string, themeDir: string): Promise<void> {
        const theme = this.themes.value.find((t) => t.id === themeId);
        if (!theme) throw new Error("Theme not found");
        // 1. 设置CSS变量
        Object.entries(theme.colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--color-${key}`, value);
        });
        // 2. 加载附加CSS
        this._removeOldThemeStyle();
        if (theme.css) {
            const styleEl = document.createElement("link");
            styleEl.rel = "stylesheet";
            styleEl.href = `${themeDir}/${theme.id}/${theme.css}`;
            styleEl.id = "theme-style";
            document.head.appendChild(styleEl);
        }
        this.currentThemeId.value = themeId;
    }

    // 卸载当前主题
    unloadTheme() {
        this._removeOldThemeStyle();
        this.currentThemeId.value = null;
    }

    private _removeOldThemeStyle() {
        const old = document.getElementById("theme-style");
        if (old) old.remove();
    }

    // 导入主题（伪代码，需解压zip并校验）
    async importTheme(file: File, themeDir: string): Promise<void> {
        // 伪代码：解压到themeDir，校验theme.json
    }

    // 导出主题（伪代码，需打包zip）
    async exportTheme(themeId: string, themeDir: string): Promise<Blob> {
        // 伪代码：读取文件夹，打包为zip
        return new Blob();
    }

    // 删除主题
    async deleteTheme(themeId: string, themeDir: string): Promise<void> {
        // 伪代码：删除themeDir/themeId文件夹
    }

    getThemes() {
        return this.themes.value;
    }

    getCurrentTheme() {
        return this.themes.value.find((t) => t.id === this.currentThemeId.value) || null;
    }

    // 加载内置主题包
    async loadBuiltInThemes(): Promise<void> {
        // 从物理文件加载内置主题
        this.themes.value = [lightTheme, darkTheme, solarizedLightTheme, solarizedDarkTheme];
    }

    // 初始化主题配置，首次运行时检测用户配置，无则fallback到dark
    async initTheme(userConfigThemeId?: string) {
        await this.loadBuiltInThemes();
        const themeId = userConfigThemeId || this.getDefaultThemeId();
        await this.applyTheme(themeId, "/src/renderer/src/themes");
    }

    // 获取默认主题id（无配置时fallback到dark）
    getDefaultThemeId(): string {
        // 伪代码：实际应从用户配置/本地存储读取
        // 若无配置，返回'dark'
        return "dark";
    }
}

export const themeManager = ThemeManager.getInstance();
