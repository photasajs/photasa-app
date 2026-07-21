import { IChusuiliangService } from "../../interfaces/chu-sui-liang.interface";
import { IFangXuanLingService } from "../../interfaces/fang-xuan-ling.interface";
import { IService } from "@renderer/interfaces/service.interface";
import { loggers } from "@photasa/common";
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
import type { Qizou } from "@renderer/interfaces/qizou.interface";
import type { Shengzhi } from "@renderer/interfaces/shengzhi.interface";
import type { Emitter } from "mitt";

export type { ThemeMeta, ThemeManager } from "./theme-manage";

const logger = loggers.chusuiliang;

export class ChusuiliangService implements IChusuiliangService, IService {
    /**
     * 启奏事件总线
     * 用于向李世民发送qizou启奏
     */
    private _qizouBus: Emitter<{ qizou: Qizou }> | null = null;

    constructor(private fangXuanLingService: IFangXuanLingService) {
        logger.info("📚 褚遂良就任，开始处理偏好管理");
    }

    /**
     * IService接口实现 - 服务名称标识
     */
    get name(): string {
        return "褚遂良";
    }

    /**
     * IService接口实现 - 设置圣旨接收通道（单向）
     * @param port MessageChannel的port2端，用于接收圣旨
     */
    setShengzhiPort(port: MessagePort): void {
        logger.info("📝 褚遂良建立圣旨接收通道");

        // 监听圣旨
        port.onmessage = async (event: MessageEvent): Promise<void> => {
            const shengzhi: Shengzhi = event.data;
            logger.info(`📝 褚遂良奉旨: ${shengzhi.command} [圣旨ID: ${shengzhi.id}]`);
            logger.debug("📝 褚遂良奉旨详情:", shengzhi);

            // 处理圣旨
            await this.processShengzhi(shengzhi);
        };
    }

    /**
     * 设置启奏事件总线
     * @param qizouBus mitt事件总线，用于发送qizou启奏
     */
    setQizouBus(qizouBus: Emitter<{ qizou: Qizou }>): void {
        logger.info("📝 褚遂良建立启奏通道");
        this._qizouBus = qizouBus;
    }

    /**
     * 处理圣旨
     * @param shengzhi 圣旨内容
     * @description
     * 目前褚遂良不需要接收圣旨，因为所有工作都是用户直接调用
     * 但保留接口以备将来扩展（如远程配置同步等）
     */
    private async processShengzhi(shengzhi: Shengzhi): Promise<void> {
        try {
            logger.warn(`📝 褚遂良收到未知圣旨命令: ${shengzhi.command}`);

            // 通过qizou启奏汇报无法处理
            this.emitQizou("shengzhi_unknown", {
                shengzhiId: shengzhi.id,
                command: shengzhi.command,
                error: "未知圣旨命令",
            });
        } catch (error) {
            logger.error("📝 褚遂良执行圣旨失败:", error);

            // 通过qizou启奏汇报失败
            this.emitQizou("shengzhi_failed", {
                shengzhiId: shengzhi.id,
                error: String(error),
            });
        }
    }

    /**
     * 向李世民启奏（通过mitt事件总线）
     * @param matter 启奏事项
     * @param content 启奏内容
     * @param type 启奏类型（request=请求批准, report=汇报完成）
     */
    private emitQizou(
        matter: string,
        content: Record<string, unknown>,
        type: "request" | "report" = "report",
    ): void {
        if (!this._qizouBus) {
            logger.error("📝 褚遂良无法启奏：启奏通道未建立");
            return;
        }

        const qizou: Qizou = {
            matter,
            content,
            from: "褚遂良",
            timestamp: Date.now(),
            metadata: { type },
        };

        logger.info(`📝 褚遂良启奏: ${matter} (${type})`);
        logger.debug("📝 褚遂良启奏详情:", qizou);

        this._qizouBus.emit("qizou", qizou);
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
            logger.info("📚 褚遂良呈文房玄龄，请求典籍中偏好设置");
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.CHU_SUILIANG,
                matter: ZOUZHE_MATTERS.GET_PREFERENCES,
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };
            await this.fangXuanLingService.processZouzhe(zouzhe);
            logger.info("📚 偏好设置典籍翻阅完成");
        } catch (error) {
            // 失败时使用本地偏好设置，不影响应用启动
            logger.error("📚 翻阅偏好典籍失败:", error);
            logger.info("📚 采用本地默认设置继续");
        }
    }

    /**
     * 更新主题设置
     *
     * 作为褚遂良（偏好管理UI门面），负责处理用户界面层的主题变更请求
     *
     * 完整流程：
     * 1. 褚遂良接收UI层主题变更请求
     * 2. 草拟主题变更文书，包含新的主题ID
     * 3. 向房玄龄（业务逻辑层）呈递文书
     * 4. 房玄龄通过袁天罡（天界通信层）上报天界
     * 5. 天界（文昌引擎）确认后，房玄龄更新本地Store
     * 6. 褚遂良等待整个流程完成，确保数据一致性
     *
     * @param themeId 新的主题ID，如 "light", "dark", "solarized-light", "solarized-dark"
     * @throws Error 当主题变更流程失败时抛出错误
     */
    async updateTheme(themeId: string): Promise<void> {
        try {
            logger.info(`🎨 褚遂良收到用户主题变更请求: ${themeId}`);

            // 草拟主题变更文书，包含业务上下文
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.CHU_SUILIANG, // 文书来源：褚遂良部门
                matter: ZOUZHE_MATTERS.THEME_CHANGE, // 文书事项：主题变更
                content: { themeId }, // 文书内容：新的主题ID
                timestamp: Date.now(), // 文书时间戳
                priority: ZOUZHE_PRIORITIES.NORMAL, // 优先级：普通
            };

            logger.info("🎨 褚遂良向房玄龄呈递主题变更文书");
            // 等待房玄龄处理文书，包括天界确认和本地Store更新
            await this.fangXuanLingService.processZouzhe(zouzhe);
            logger.info(`🎨 主题设置已更新完成: ${themeId}`);
        } catch (error) {
            logger.error(`🎨 主题设置更新失败: ${themeId}`, error);
            throw error;
        }
    }

    /**
     * 更新语言设置
     * 通过文书向房玄龄上报语言变更
     */
    async updateLanguage(locale: string): Promise<void> {
        try {
            logger.info(`📝 褚遂良收到用户语言变更请求: ${locale}`);

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.CHU_SUILIANG,
                matter: ZOUZHE_MATTERS.LANGUAGE_CHANGE,
                content: { locale },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info("📝 褚遂良向房玄龄呈递语言变更文书");
            await this.fangXuanLingService.processZouzhe(zouzhe);
            logger.info(`📝 语言设置已更新完成: ${locale}`);
        } catch (error) {
            logger.error(`📝 语言设置更新失败: ${locale}`, error);
            throw error;
        }
    }

    /**
     * 更新缩略图大小
     * 通过文书向房玄龄上报缩略图大小变更
     */
    async updateThumbnailSize(size: number): Promise<void> {
        try {
            logger.info(`🎨 褚遂良收到用户缩略图大小变更请求: ${size}`);

            // 验证缩略图大小范围
            const validSize = size >= 150 && size <= 400 ? size : 150;

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.CHU_SUILIANG,
                matter: ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE,
                content: { size: validSize },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            logger.info("🎨 褚遂良向房玄龄呈递缩略图大小变更文书");
            await this.fangXuanLingService.processZouzhe(zouzhe);
            logger.info(`🎨 缩略图大小已更新完成: ${validSize}`);
        } catch (error) {
            logger.error(`🎨 缩略图大小更新失败: ${size}`, error);
            throw error;
        }
    }

    /**
     * 添加监控路径（常规工作，不需要李世民批准）
     * 完成后向朝廷呈递奏章，触发跨部门协调（如扫描任务）
     * 集成RFC 0012统一路径处理和验证
     */
    async addPath(path: string): Promise<void> {
        try {
            logger.info(`📝 褚遂良收到用户添加路径请求: ${path}`);

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

            logger.info("📝 褚遂良向房玄龄呈递路径添加文书（常规工作）", {
                normalizedPath: duplicationResult.normalizedPath,
                pathType: pathType.type,
            });
            const response = await this.fangXuanLingService.processZouzhe(zouzhe);
            if (!response.approved) {
                throw new Error(response.instruction ?? "偏好持久化未获准");
            }
            logger.info(`📝 路径添加工作完成: ${duplicationResult.normalizedPath}`);
        } catch (error) {
            logger.error(`📝 路径添加失败: ${path}`, error);
            throw error;
        }
    }

    /**
     * 移除监控路径（常规工作，不需要李世民批准）
     * 完成后向朝廷呈递奏章，触发跨部门协调（如移除扫描任务）
     * 集成RFC 0012统一路径处理和验证
     */
    async removePath(path: string): Promise<void> {
        try {
            logger.info(`📝 褚遂良收到用户移除路径请求: ${path}`);

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

            logger.info("📝 褚遂良向房玄龄呈递路径移除文书（常规工作）", {
                normalizedPath: validationResult.normalizedPath,
                pathType: pathType.type,
            });
            const response = await this.fangXuanLingService.processZouzhe(zouzhe);
            if (!response.approved) {
                throw new Error(response.instruction ?? "偏好持久化未获准");
            }
            logger.info(`📝 路径移除工作完成: ${validationResult.normalizedPath}`);
        } catch (error) {
            logger.error(`📝 路径移除失败: ${path}`, error);
            throw error;
        }
    }

    /**
     * 添加扫描文件夹
     * 通过文书向房玄龄上报扫描文件夹添加
     * 集成RFC 0012统一路径处理和验证
     */
    async addScanFolder(
        folder: string,
        action: "scan" | "rescan" | "current",
        source: "user" | "auto" = "user",
    ): Promise<void> {
        try {
            logger.info(`📝 褚遂良收到扫描文件夹请求: ${folder}, 动作: ${action}, 来源: ${source}`);

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

            logger.info("📝 褚遂良向房玄龄呈递扫描文件夹添加文书", {
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
