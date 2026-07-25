/**
 * 主题管理器 - 阎立本画师
 * 为人界界面提供主题管理功能，实现依赖注入模式
 *
 * 神话背景：
 * 阎立本，唐朝著名画家，以善于绘制人物、风景著称
 * 在Photasa系统中，阎立本化身人界界面画师，负责主题风格设计
 * 通过民间Vue技术，为人界界面提供美观的主题切换功能
 * 与房玄龄宰相协作，确保界面风格与用户偏好保持一致
 */
import { ref } from "vue";
import lightTheme from "@renderer/themes/light/theme.json";
import darkTheme from "@renderer/themes/dark/theme.json";
import solarizedLightTheme from "@renderer/themes/solarized-light/theme.json";
import solarizedDarkTheme from "@renderer/themes/solarized-dark/theme.json";
import type { IThemeManager, ThemeMeta } from "@renderer/interfaces/chu-sui-liang.interface";
import { THEME_STYLESHEETS } from "./theme-styles";

// 导出ThemeMeta类型供其他模块使用
export type { ThemeMeta };

/**
 * 默认主题id
 */
const ThemeId = {
    SolarizedDark: "solarized-dark",
    SolarizedLight: "solarized-light",
    Dark: "dark",
    Light: "light",
};

/**
 * 主题管理器 - 阎立本画师画匣子
 */
export class ThemeManager implements IThemeManager {
    /**
     * 实例
     */
    private static _instance: ThemeManager;
    private themes = ref<ThemeMeta[]>([]);
    private currentThemeId = ref<string | null>(null);

    /**
     * 获取实例
     */
    static getInstance() {
        if (!ThemeManager._instance) {
            ThemeManager._instance = new ThemeManager();
        }
        return ThemeManager._instance;
    }

    // 加载本地主题包
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async loadLocalThemes(_themeDir: string): Promise<void> {
        // TODO伪代码：实际需用legacy Node API读取目录和json
        // const themeFolders = await fs.readdir(themeDir);
        // for (const folder of themeFolders) {
        // const meta = await fs.readJson(`${themeDir}/${folder}/theme.json`);
        // this.themes.value.push({ ...meta, id: folder });
        // }
    }

    /**
     * 应用主题（仅负责视觉呈现，不直接操作Store）
     * Store更新应通过房玄龄服务处理，维护天人合一架构
     */
    async applyTheme(themeId: string): Promise<void> {
        const theme = this.themes.value.find((t) => t.id === themeId);
        if (!theme) throw new Error("Theme not found");

        // 1. 设置 CSS 变量（theme.json 子集）
        Object.entries(theme.colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--color-${key}`, value);
        });

        // 2. 注入打包进 bundle 的 theme.css（含 tree-bg、splitter 等完整变量）
        this._removeOldThemeStyle();
        const stylesheet = THEME_STYLESHEETS[themeId];
        if (stylesheet) {
            const styleEl = document.createElement("style");
            styleEl.textContent = stylesheet;
            styleEl.id = "theme-style";
            document.head.appendChild(styleEl);
        }

        document.documentElement.setAttribute("data-theme", themeId);

        // 3. 记录当前主题（仅用于内部状态跟踪）
        this.currentThemeId.value = themeId;

        // 注意：Store更新由调用者（阎立本）通过房玄龄服务处理
        // 不在此处直接操作Store，维护架构清晰
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async importTheme(_file: File, _themeDir: string): Promise<void> {
        // 伪代码：解压到themeDir，校验theme.json
    }

    // 导出主题（伪代码，需打包zip）
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async exportTheme(_themeId: string, _themeDir: string): Promise<Blob> {
        // 伪代码：读取文件夹，打包为zip
        return new Blob();
    }

    // 删除主题
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async deleteTheme(_themeId: string, _themeDir: string): Promise<void> {
        // 伪代码：删除themeDir/themeId文件夹
    }

    getThemes() {
        return this.themes.value;
    }

    getCurrentTheme(): ThemeMeta | null {
        return this.themes.value.find((t) => t.id === this.currentThemeId.value) || null;
    }

    /**
     * 加载内置主题包（仅加载主题数据，不应用主题）
     * 主题应用应由调用者通过房玄龄服务处理
     */
    async loadBuiltInThemes(): Promise<void> {
        // 从物理文件加载内置主题
        this.themes.value = [lightTheme, darkTheme, solarizedLightTheme, solarizedDarkTheme];
        // 注意：不在此处自动应用主题
        // 主题选择和应用应由UI组件通过房玄龄服务处理
    }

    /**
     * 初始化主题配置
     * 注意：此方法仅在应用启动时调用，用于恢复用户的主题设置
     * 此时房玄龄服务可能尚未就绪，因此直接应用主题样式
     * 后续的主题切换应通过房玄龄服务处理
     */
    async initTheme(userConfigThemeId?: string) {
        await this.loadBuiltInThemes();
        const themeId = userConfigThemeId || this.getDefaultThemeId();
        await this.applyTheme(themeId);
    }

    // 获取默认主题id（无配置时fallback到dark）
    getDefaultThemeId(): string {
        // 伪代码：实际应从用户配置/本地存储读取
        // 若无配置，返回'dark'
        return ThemeId.Dark;
    }
}

/**
 * 主题管理器实例
 */
export function getThemeManager() {
    return ThemeManager.getInstance();
}
