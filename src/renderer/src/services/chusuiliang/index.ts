import { IChusuiliangService } from "../../interfaces/chu-sui-liang.interface";
import { IFangXuanLingService } from "../../interfaces/fang-xuan-ling.interface";
import { loggers } from "@common/logger";
import {
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
    GUANYUAN_NAMES,
    type Zouzhe,
} from "../../interfaces/fang-xuan-ling.interface";
import { getThemeManager } from "./theme-manage";

export type { ThemeMeta, ThemeManager } from "./theme-manage";

const logger = loggers.chusuiliang;

export class ChusuiliangService implements IChusuiliangService {
    constructor(private fangXuanLingService: IFangXuanLingService) {
        logger.info("🔮 就任，开始处理偏好管理");
    }

    /**
     * 获取缩略图大小
     */
    get thumbnailSize() {
        return this.fangXuanLingService.preference.thumbnailSize;
    }
    set thumbnailSize(size: number) {
        this.updateThumbnailSize(size);
    }

    /**
     * 获取主题设置
     */
    get currentTheme() {
        return this.fangXuanLingService.preference.currentTheme;
    }
    set currentTheme(themeId: string) {
        this.updateTheme(themeId);
    }

    get themeManager() {
        return getThemeManager();
    }

    /**
     * 初始化偏好设置
     * 直接通过preference store调用Tianshu工作流加载偏好设置
     */
    async initializePreferences() {
        try {
            logger.info("📦 向房玄龄宰相发送奏折，请求获取偏好设置");
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.CHU_SUILIANG,
                matter: ZOUZHE_MATTERS.GET_PREFERENCES,
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };
            await this.fangXuanLingService.processZouzhe(zouzhe);
            logger.info("📦 偏好设置初始化完成");
        } catch (error) {
            // 失败时使用本地偏好设置，不影响应用启动
            logger.error("📦 初始化偏好设置失败:", error);
            logger.info("📦 使用本地默认偏好设置继续启动");
        }
    }

    /**
     * 更新主题设置
     * 通过奏折向房玄龄上报主题变更
     */
    async updateTheme(themeId: string): Promise<void> {
        try {
            logger.info(`📦 准备更新主题设置: ${themeId}`);

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.CHU_SUILIANG,
                matter: ZOUZHE_MATTERS.THEME_CHANGE,
                content: { themeId },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info("📦 向房玄龄宰相发送主题变更奏折");
            await this.fangXuanLingService.processZouzhe(zouzhe);
            logger.info(`📦 主题设置更新完成: ${themeId}`);
        } catch (error) {
            logger.error(`📦 主题设置更新失败: ${themeId}`, error);
            throw error;
        }
    }

    /**
     * 更新语言设置
     * 通过奏折向房玄龄上报语言变更
     */
    async updateLanguage(locale: string): Promise<void> {
        try {
            logger.info(`📦 准备更新语言设置: ${locale}`);

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.CHU_SUILIANG,
                matter: ZOUZHE_MATTERS.LANGUAGE_CHANGE,
                content: { locale },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info("📦 向房玄龄宰相发送语言变更奏折");
            await this.fangXuanLingService.processZouzhe(zouzhe);
            logger.info(`📦 语言设置更新完成: ${locale}`);
        } catch (error) {
            logger.error(`📦 语言设置更新失败: ${locale}`, error);
            throw error;
        }
    }

    /**
     * 更新缩略图大小
     * 通过奏折向房玄龄上报缩略图大小变更
     */
    async updateThumbnailSize(size: number): Promise<void> {
        try {
            logger.info(`📦 准备更新缩略图大小: ${size}`);

            // 验证缩略图大小范围
            const validSize = size >= 150 && size <= 400 ? size : 150;

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.CHU_SUILIANG,
                matter: ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE,
                content: { size: validSize },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info("📦 向房玄龄宰相发送缩略图大小变更奏折");
            await this.fangXuanLingService.processZouzhe(zouzhe);
            logger.info(`📦 缩略图大小更新完成: ${validSize}`);
        } catch (error) {
            logger.error(`📦 缩略图大小更新失败: ${size}`, error);
            throw error;
        }
    }
}
