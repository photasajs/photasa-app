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
import {
    validateAndNormalizePath,
    checkPathDuplication,
    isPathSafe,
    detectPathType,
    PathProcessingStats,
} from "./path-utils";

export type { ThemeMeta, ThemeManager } from "./theme-manage";

const logger = loggers.chusuiliang;

export class ChusuiliangService implements IChusuiliangService {
    constructor(private fangXuanLingService: IFangXuanLingService) {
        logger.info("📚 就任，开始处理偏好管理");
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
     *
     * 作为褚遂良（偏好管理UI门面），负责处理用户界面层的主题变更请求
     *
     * 完整流程：
     * 1. 褚遂良接收UI层主题变更请求
     * 2. 创建主题变更奏折，包含新的主题ID
     * 3. 向房玄龄（业务逻辑层）发送奏折
     * 4. 房玄龄通过袁天罡（天界通信层）上报天界
     * 5. 天界（文昌引擎）确认后，房玄龄更新本地Store
     * 6. 褚遂良等待整个流程完成，确保数据一致性
     *
     * @param themeId 新的主题ID，如 "light", "dark", "solarized-light", "solarized-dark"
     * @throws Error 当主题变更流程失败时抛出错误
     */
    async updateTheme(themeId: string): Promise<void> {
        try {
            logger.info(`📦 褚遂良接收主题变更请求: ${themeId}`);

            // 创建主题变更奏折，包含业务上下文
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.CHU_SUILIANG, // 奏折来源：褚遂良部门
                matter: ZOUZHE_MATTERS.THEME_CHANGE, // 奏折事项：主题变更
                content: { themeId }, // 奏折内容：新的主题ID
                timestamp: Date.now(), // 奏折时间戳
                priority: ZOUZHE_PRIORITIES.NORMAL, // 优先级：普通
            };

            logger.info("📦 褚遂良向房玄龄宰相发送主题变更奏折");
            // 等待房玄龄处理奏折，包括天界确认和本地Store更新
            await this.fangXuanLingService.processZouzhe(zouzhe);
            logger.info(`📦 褚遂良确认主题设置更新完成: ${themeId}`);
        } catch (error) {
            logger.error(`📦 褚遂良处理主题设置更新失败: ${themeId}`, error);
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

    /**
     * 添加监控路径
     * 通过奏折向房玄龄上报路径添加
     * 集成RFC 0012统一路径处理和验证
     */
    async addPath(path: string): Promise<void> {
        try {
            logger.info(`📝 准备添加监控路径: ${path}`);

            // 使用统一路径验证和规范化
            const validationResult = validateAndNormalizePath(path);
            if (!validationResult.isValid) {
                const errorMessage = `路径验证失败: ${validationResult.error}`;
                logger.error("📝 路径验证失败", { path, error: validationResult.error });
                throw new Error(errorMessage);
            }

            // 检查路径安全性
            if (!isPathSafe(validationResult.normalizedPath)) {
                const errorMessage = "检测到不安全的路径模式";
                logger.error("📝 路径安全检查失败", { path: validationResult.normalizedPath });
                throw new Error(errorMessage);
            }

            // 检查路径重复
            const currentPaths = this.paths;
            const duplicationResult = checkPathDuplication(path, currentPaths);
            if (duplicationResult.isDuplicate) {
                const errorMessage = `路径已存在: ${duplicationResult.existingMatch}`;
                logger.warn("📝 检测到重复路径", {
                    newPath: duplicationResult.normalizedPath,
                    existingPath: duplicationResult.existingMatch,
                });
                throw new Error(errorMessage);
            }

            // 记录路径处理统计
            const pathType = detectPathType(path);
            PathProcessingStats.getInstance().recordPathProcessing(validationResult, pathType);

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.CHU_SUILIANG,
                matter: ZOUZHE_MATTERS.ADD_PATH,
                content: {
                    path: duplicationResult.normalizedPath, // 使用规范化后的路径
                    originalPath: path, // 保留原始路径用于日志
                    pathType: pathType.type,
                    platform: pathType.platform,
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info("📝 向房玄龄宰相发送路径添加奏折", {
                normalizedPath: duplicationResult.normalizedPath,
                pathType: pathType.type,
            });
            await this.fangXuanLingService.processZouzhe(zouzhe);
            logger.info(`📝 监控路径添加完成: ${duplicationResult.normalizedPath}`);
        } catch (error) {
            logger.error(`📝 监控路径添加失败: ${path}`, error);
            throw error;
        }
    }

    /**
     * 移除监控路径
     * 通过奏折向房玄龄上报路径移除
     * 集成RFC 0012统一路径处理和验证
     */
    async removePath(path: string): Promise<void> {
        try {
            logger.info(`📝 准备移除监控路径: ${path}`);

            // 使用统一路径验证和规范化
            const validationResult = validateAndNormalizePath(path);
            if (!validationResult.isValid) {
                const errorMessage = `路径验证失败: ${validationResult.error}`;
                logger.error("📝 路径验证失败", { path, error: validationResult.error });
                throw new Error(errorMessage);
            }

            // 检查路径是否存在于当前路径列表中
            const currentPaths = this.paths;
            const existsInPaths = currentPaths.some((existingPath) => {
                const existingValidation = validateAndNormalizePath(existingPath);
                return (
                    existingValidation.isValid &&
                    existingValidation.normalizedPath === validationResult.normalizedPath
                );
            });

            if (!existsInPaths) {
                const errorMessage = `路径不存在于监控列表中: ${validationResult.normalizedPath}`;
                logger.warn("📝 尝试移除不存在的路径", {
                    path: validationResult.normalizedPath,
                    currentPaths,
                });
                throw new Error(errorMessage);
            }

            // 记录路径处理统计
            const pathType = detectPathType(path);
            PathProcessingStats.getInstance().recordPathProcessing(validationResult, pathType);

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.CHU_SUILIANG,
                matter: ZOUZHE_MATTERS.REMOVE_PATH,
                content: {
                    path: validationResult.normalizedPath, // 使用规范化后的路径
                    originalPath: path, // 保留原始路径用于日志
                    pathType: pathType.type,
                    platform: pathType.platform,
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info("📝 向房玄龄宰相发送路径移除奏折", {
                normalizedPath: validationResult.normalizedPath,
                pathType: pathType.type,
            });
            await this.fangXuanLingService.processZouzhe(zouzhe);
            logger.info(`📝 监控路径移除完成: ${validationResult.normalizedPath}`);
        } catch (error) {
            logger.error(`📝 监控路径移除失败: ${path}`, error);
            throw error;
        }
    }

    /**
     * 添加扫描文件夹
     * 通过奏折向房玄龄上报扫描文件夹添加
     * 集成RFC 0012统一路径处理和验证
     */
    async addScanFolder(
        folder: string,
        action: "scan" | "rescan" | "current",
        source: "user" | "auto" = "user",
    ): Promise<void> {
        try {
            logger.info(`📝 准备添加扫描文件夹: ${folder}, 动作: ${action}, 来源: ${source}`);

            // 使用统一路径验证和规范化
            const validationResult = validateAndNormalizePath(folder);
            if (!validationResult.isValid) {
                const errorMessage = `扫描文件夹路径验证失败: ${validationResult.error}`;
                logger.error("📝 扫描文件夹路径验证失败", {
                    folder,
                    error: validationResult.error,
                });
                throw new Error(errorMessage);
            }

            // 检查路径安全性
            if (!isPathSafe(validationResult.normalizedPath)) {
                const errorMessage = "检测到不安全的扫描文件夹路径模式";
                logger.error("📝 扫描文件夹路径安全检查失败", {
                    folder: validationResult.normalizedPath,
                });
                throw new Error(errorMessage);
            }

            // 记录路径处理统计
            const pathType = detectPathType(folder);
            PathProcessingStats.getInstance().recordPathProcessing(validationResult, pathType);

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.CHU_SUILIANG,
                matter: ZOUZHE_MATTERS.ADD_SCAN_FOLDER,
                content: {
                    folder: validationResult.normalizedPath, // 使用规范化后的路径
                    originalFolder: folder, // 保留原始路径用于日志
                    action,
                    source,
                    pathType: pathType.type,
                    platform: pathType.platform,
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info("📝 向房玄龄宰相发送扫描文件夹添加奏折", {
                normalizedFolder: validationResult.normalizedPath,
                action,
                source,
                pathType: pathType.type,
            });
            await this.fangXuanLingService.processZouzhe(zouzhe);
            logger.info(`📝 扫描文件夹添加完成: ${validationResult.normalizedPath}`);
        } catch (error) {
            logger.error(`📝 扫描文件夹添加失败: ${folder}`, error);
            throw error;
        }
    }

    /**
     * 获取监控路径列表
     */
    get paths(): string[] {
        return this.fangXuanLingService.preference.paths;
    }
}
