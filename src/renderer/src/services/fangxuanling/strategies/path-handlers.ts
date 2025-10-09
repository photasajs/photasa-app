/**
 * 路径文书处理司
 * 朝廷处理路径相关文书的各路文官：添加、移除、扫描等
 *
 * 治理之道：
 * 1. 直接处理：每位文官各司其职，专事专办
 * 2. 文书传递：所需典籍通过文案传递，便于查验
 * 3. 官员协作：支持多位文官协同处理复杂事务
 * 4. 即事即办：无需繁琐仪式，有事直接处理
 *
 * 唐代官制精神：
 * - 消除繁复的层级结构
 * - 明确的官员职责划分
 * - 简政便民，高效务实
 * - 便于考核和监察
 */

import type { Zouzhe } from "@renderer/interfaces/fang-xuan-ling.interface";
import type { PathOperationParams } from "./types";

/**
 * 文官办公所需
 * 所有文官处理文书所需的典籍和工具
 */
export interface StrategyDependencies {
    logger: {
        debug: (message: string, data?: any) => void;
        info: (message: string, data?: any) => void;
        warn: (message: string, data?: any) => void;
        error: (message: string, data?: any) => void;
    };
    preferenceService: {
        addPath: (path: string) => Promise<void>;
        removePath: (path: string) => Promise<void>;
        addScanFolder: (folder: string, action: string, source?: string) => Promise<void>;
        updateTheme: (themeId: string) => Promise<void>;
        updateLanguage: (locale: string) => Promise<void>;
        updateThumbnailSize: (size: number) => Promise<void>;
        loadPreferences: () => Promise<void>;
    };
}

/**
 * 文官处理函数规范
 */
export type Wenguan = (zouzhe: Zouzhe, dependencies: StrategyDependencies) => Promise<void>;

/**
 * 路径添加文官
 * 处理民间添加监控路径的文书
 */
export const handleAddPath: Wenguan = async (zouzhe, { logger, preferenceService }) => {
    const params = zouzhe.content as PathOperationParams;

    logger.debug("🏛️ 朝廷开衙，处理路径添加文书", { path: params.path });

    if (!params.path) {
        throw new Error("路径参数缺失");
    }

    await preferenceService.addPath(params.path);
    logger.info(`🏛️ 路径添加文书处理完成: ${params.path}`);
};

/**
 * 路径移除文官
 * 处理民间移除监控路径的文书
 */
export const handleRemovePath: Wenguan = async (zouzhe, { logger, preferenceService }) => {
    const params = zouzhe.content as PathOperationParams;

    logger.debug("🏛️ 朝廷开衙，处理路径移除文书", { path: params.path });

    if (!params.path) {
        throw new Error("路径参数缺失");
    }

    await preferenceService.removePath(params.path);
    logger.info(`🏛️ 路径移除文书处理完成: ${params.path}`);
};

/**
 * 扫描文件夹文官
 * 处理民间请求扫描文件夹的文书
 */
export const handleAddScanFolder: Wenguan = async (zouzhe, { logger, preferenceService }) => {
    const params = zouzhe.content as PathOperationParams;

    logger.debug("🏛️ 朝廷开衙，处理扫描文件夹添加文书", {
        folder: params.folder,
        action: params.action,
        source: params.source,
    });

    if (!params.folder || !params.action) {
        throw new Error("扫描文件夹参数缺失");
    }

    await preferenceService.addScanFolder(params.folder, params.action, params.source || "user");
    logger.info(`🏛️ 扫描文件夹添加文书处理完成: ${params.folder}`);
};

/**
 * 主题变更文官
 * 处理民间主题切换的文书
 */
export const handleThemeChange: Wenguan = async (zouzhe, { logger, preferenceService }) => {
    const params = zouzhe.content as PathOperationParams;

    logger.debug("🏛️ 朝廷开衙，处理主题变更文书", { themeId: params.themeId });

    if (!params.themeId) {
        throw new Error("主题ID参数缺失");
    }

    await preferenceService.updateTheme(params.themeId);
    logger.info(`🏛️ 主题变更文书处理完成: ${params.themeId}`);
};

/**
 * 语言变更文官
 * 处理民间语言切换的文书
 */
export const handleLanguageChange: Wenguan = async (zouzhe, { logger, preferenceService }) => {
    const params = zouzhe.content as PathOperationParams;

    logger.debug("🏛️ 朝廷开衙，处理语言变更文书", { locale: params.locale });

    if (!params.locale) {
        throw new Error("语言参数缺失");
    }

    await preferenceService.updateLanguage(params.locale);
    logger.info(`🏛️ 语言变更文书处理完成: ${params.locale}`);
};

/**
 * 缩略图大小文官
 * 处理民间调整缩略图大小的文书
 */
export const handleThumbnailSizeChange: Wenguan = async (zouzhe, { logger, preferenceService }) => {
    const params = zouzhe.content as PathOperationParams;

    logger.debug("🏛️ 朝廷开衙，处理缩略图大小变更文书", { size: params.size });

    if (params.size === undefined) {
        throw new Error("缩略图大小参数缺失");
    }

    await preferenceService.updateThumbnailSize(params.size);
    logger.info(`🏛️ 缩略图大小变更文书处理完成: ${params.size}`);
};

/**
 * 偏好获取文官
 * 处理获取当前偏好设置的文书
 */
export const handleGetPreferences: Wenguan = async (_zouzhe, { logger, preferenceService }) => {
    logger.debug("🏛️ 朝廷开衙，处理偏好获取文书");

    await preferenceService.loadPreferences();
    logger.info("🏛️ 偏好获取文书处理完成");
};

/**
 * 文官司籍
 * 将奏折事类映射到对应的文官
 */
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";

export const WENGUAN_REGISTRY = {
    [ZOUZHE_MATTERS.ADD_PATH]: handleAddPath,
    [ZOUZHE_MATTERS.REMOVE_PATH]: handleRemovePath,
    [ZOUZHE_MATTERS.ADD_SCAN_FOLDER]: handleAddScanFolder,
    [ZOUZHE_MATTERS.THEME_CHANGE]: handleThemeChange,
    [ZOUZHE_MATTERS.LANGUAGE_CHANGE]: handleLanguageChange,
    [ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE]: handleThumbnailSizeChange,
    [ZOUZHE_MATTERS.GET_PREFERENCES]: handleGetPreferences,
} as const;

/**
 * 文书司
 * 根据奏折类型调遣对应的文官
 */
export const executeStrategy = async (
    zouzhe: Zouzhe,
    dependencies: StrategyDependencies,
): Promise<void> => {
    const wenguan = WENGUAN_REGISTRY[zouzhe.matter];

    if (!wenguan) {
        throw new Error(`未知的奏折类型: ${zouzhe.matter}`);
    }

    try {
        await wenguan(zouzhe, dependencies);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`文官处理失败 [${zouzhe.matter}]: ${errorMessage}`);
    }
};

/**
 * 获取所有文官信息
 * 用于内政监察和官员考核
 */
export const getAvailableWenguan = (): Array<{ matter: string; wenguanName: string }> => {
    return Object.entries(WENGUAN_REGISTRY).map(([matter, wenguan]) => ({
        matter,
        wenguanName: wenguan.name,
    }));
};
