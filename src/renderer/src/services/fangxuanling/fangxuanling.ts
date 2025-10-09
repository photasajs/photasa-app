/**
 * 房玄龄宰相服务实现
 * 唐朝宰相统筹所有政务部门，为UI组件提供统一接口
 */

import type {
    IFangXuanLingService,
    IPreference,
    INotification,
    IPhotos,
    Zouzhe,
    ZouzheResponse,
    Zhaoling,
} from "../../interfaces/fang-xuan-ling.interface";
import type { IYuanTianGangService } from "../../interfaces/yuan-tian-gang.interface";
import {
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
    ZHAOLING_PRIORITIES,
    ERROR_MESSAGES,
} from "../../interfaces/fang-xuan-ling.interface";
import { usePreferenceStore } from "../../stores/preference";
import { useNotificationStore } from "../../stores/notification";
import { usePhotosStore } from "../../stores/photos";
import { loggers } from "@common/logger";
import { mergePreferencesFromTianjie, applyPreferencesToStore } from "./utils";
import { PathOperationStrategy, type StrategyContext } from "./strategies/PathOperationStrategy";

const logger = loggers.fangxuanling;

/**
 * 房玄龄宰相服务实现
 * 统筹管理所有Store，提供统一API接口
 */
export class FangXuanLingService implements IFangXuanLingService {
    private _preference: IPreference;
    private _notification: INotification;
    private _photos: IPhotos;
    private _yuanTianGang!: IYuanTianGangService;
    private _strategyExecutor: PathOperationStrategy;

    constructor(yuanTianGang: IYuanTianGangService) {
        if (!yuanTianGang) {
            throw new Error("袁天罡钦天监服务未注入");
        }

        this._yuanTianGang = yuanTianGang;
        logger.info("📜 就任，开始统筹政务");

        // 初始化各部门管理器
        this._preference = this.createPreference();
        this._notification = this.createNotification();
        this._photos = this.createPhotos();

        // 初始化文书总管司，消除繁复的衙门层级
        const strategyContext: StrategyContext = {
            preferenceService: this.createPreferenceServiceProxy(),
            logger,
            errorHandler: (error: Error, context: string) => {
                logger.error(`📜 文书处理失败 [${context}]:`, error);
            },
        };
        this._strategyExecutor = new PathOperationStrategy(strategyContext);

        logger.info("📜 已完成各部门管理器和文书总管司初始化");
    }

    get preference(): IPreference {
        return this._preference;
    }

    get notification(): INotification {
        return this._notification;
    }

    get photos(): IPhotos {
        return this._photos;
    }

    async processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse> {
        logger.info(`📜 处理${zouzhe.department}奏折: ${zouzhe.matter}`, zouzhe);

        try {
            // 使用文书总管司处理奏折，消除繁复的衙门层级
            // 这体现了Linus "好品味"原则：清晰的逻辑分离
            const startTime = Date.now();

            // 检查是否为路径操作类型奏折（✅ 简化后的新架构）
            if (this.isPathOperation(zouzhe.matter)) {
                logger.debug("📜 房玄龄处理路径业务逻辑");

                // ✅ 在人界计算新的完整状态（业务逻辑）
                const delta = await this.computePreferenceDelta(zouzhe);

                // 上报天界持久化
                const zhaoling: Zhaoling = {
                    command: zouzhe.matter, // ✅ 保持业务语义，袁天罡负责映射到工作流ID
                    context: delta, // 发送完整的delta
                    timestamp: Date.now(),
                    source: zouzhe.department,
                    priority:
                        zouzhe.priority === ZOUZHE_PRIORITIES.URGENT
                            ? ZHAOLING_PRIORITIES.URGENT
                            : ZHAOLING_PRIORITIES.NORMAL,
                    requiresTianshuApproval: true,
                };

                const tianjieDelta = await this._yuanTianGang.executeZhaoling(zhaoling);
                const processTime = Date.now() - startTime;

                // 天界确认成功后，更新本地Store
                if (tianjieDelta.acknowledged) {
                    this.applyDeltaToStore(delta);
                }

                const response: ZouzheResponse = {
                    approved: tianjieDelta.acknowledged,
                    matter: zouzhe.matter,
                    data: { success: true, delta, tianjieDelta },
                    instruction: "路径操作已处理并持久化",
                    timestamp: Date.now(),
                    officials: ["房玄龄"],
                    metadata: {
                        processTime,
                        escalated: true,
                    },
                };

                logger.info(`📜 路径操作处理完成: ${zouzhe.matter}, 耗时: ${processTime}ms`);
                return response;
            }

            // 检查是否为其他策略可处理的奏折类型
            if (this.isStrategyHandledMatter(zouzhe.matter)) {
                logger.debug("📜 委派文书总管司处理偏好管理奏折");

                // 文书总管司会自动调遣文官处理所有偏好相关文书
                await this._strategyExecutor.execute(zouzhe);

                // 文书处理完成后，仍需上报天界进行记录
                const zhaoling: Zhaoling = {
                    command: zouzhe.matter,
                    context: zouzhe.content || {},
                    timestamp: Date.now(),
                    source: zouzhe.department,
                    priority:
                        zouzhe.priority === ZOUZHE_PRIORITIES.URGENT
                            ? ZHAOLING_PRIORITIES.URGENT
                            : ZHAOLING_PRIORITIES.NORMAL,
                    requiresTianshuApproval: true,
                };

                // 上报天界记录文书处理结果
                const tianjieDelta = await this._yuanTianGang.executeZhaoling(zhaoling);
                const processTime = Date.now() - startTime;

                // 天界确认成功后，更新本地Store
                if (tianjieDelta.acknowledged) {
                    this.updateStoreAfterTianjieConfirmation(zouzhe);
                }

                // 返回文书处理成功的批复
                const response: ZouzheResponse = {
                    approved: tianjieDelta.acknowledged,
                    matter: zouzhe.matter,
                    data: { success: true, processed: "策略执行器处理完成", tianjieDelta },
                    instruction: "偏好设置已通过策略模式处理并上报天界",
                    timestamp: Date.now(),
                    officials: ["房玄龄", "策略执行器"],
                    metadata: {
                        processTime,
                        escalated: true,
                        strategy: "PathOperationStrategy",
                    },
                };

                logger.info(`📜 文书处理完成: ${zouzhe.matter}, 耗时: ${processTime}ms`);
                return response;
            }

            // 处理非文书总管司类型的奏折（如通知、照片切换等）
            const instruction = this.getInstructionForMatter(zouzhe.matter);
            const needsEscalation = this.shouldEscalateToTianjie(zouzhe.matter, zouzhe.priority);

            if (needsEscalation) {
                // 对于需要上报天界但不通过策略处理的事务
                const zhaoling: Zhaoling = {
                    command: zouzhe.matter,
                    context: zouzhe.content,
                    timestamp: Date.now(),
                    source: zouzhe.department,
                    priority:
                        zouzhe.priority === ZOUZHE_PRIORITIES.URGENT
                            ? ZHAOLING_PRIORITIES.URGENT
                            : ZHAOLING_PRIORITIES.NORMAL,
                    requiresTianshuApproval: true,
                };

                if (this._yuanTianGang) {
                    const zhaolingResponse = await this._yuanTianGang.executeZhaoling(zhaoling);
                    const processTime = Date.now() - startTime;

                    const businessData = this.unboxZhaolingResponse(zhaolingResponse);
                    const reboxedResponse = this.reboxAsZouzheResponse(
                        zouzhe,
                        businessData,
                        zhaolingResponse,
                        processTime,
                        instruction,
                    );

                    logger.info(`📜 诏令执行完成: ${zhaoling.command}, 耗时: ${processTime}ms`);
                    return reboxedResponse;
                }
            }

            // 不需要上报天界的情况，直接返回宰相处理结果
            const response: ZouzheResponse = {
                approved: true,
                matter: zouzhe.matter,
                data: zouzhe.content,
                instruction,
                timestamp: Date.now(),
                metadata: {
                    processTime: Date.now() - startTime,
                    escalated: false,
                },
            };

            logger.info(`📜 房玄龄直接处理奏折: ${zouzhe.matter}`);
            return response;
        } catch (error) {
            logger.error(`❌ 奏疏有误，请重新草拟: ${zouzhe.matter}`, error);

            return {
                approved: false,
                matter: zouzhe.matter,
                data: {
                    error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
                    originalRequest: zouzhe.content,
                },
                instruction: `${ERROR_MESSAGES.PROCESSING_FAILED}: ${error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR}`,
                timestamp: Date.now(),
                metadata: {
                    processTime: 0,
                    escalated: false,
                },
            };
        }
    }

    getGlobalState() {
        return {
            preference: this._preference.state,
            notification: this._notification.notifications,
            photos: this._photos.photos,
        };
    }

    resetAll() {
        logger.warn("🏛️ 朝廷下令，重整朝纲");

        // 调用各store的重置方法
        const preferenceStore = usePreferenceStore();
        const notificationStore = useNotificationStore();
        const photosStore = usePhotosStore();

        preferenceStore.$reset();
        notificationStore.$reset();
        photosStore.$reset();

        logger.info("🏛️ 重整朝纲已毕，百官归位");
    }

    /**
     * 创建偏好管理器
     */
    private createPreference(): IPreference {
        const store = usePreferenceStore();

        // 注意：主题和语言更新现在应该通过褚遂良的奏折链路处理
        // 房玄龄只负责处理奏折并与天界通信，不直接操作Store
        // Store的更新应该在天界响应后由相应的处理机制完成

        return {
            // 主题管理
            get currentTheme() {
                return store.preferences.ui.theme;
            },

            // 语言管理
            get currentLanguage() {
                return store.preferences.ui.language;
            },

            // 暗色模式
            get isDarkMode() {
                return store.preferences.ui.theme === "dark";
            },

            // 缩略图大小 - 只读访问
            get thumbnailSize() {
                return store.preferences.display.thumbnailSize;
            },

            // 路径管理 - 只读访问
            get paths() {
                return store.appState.paths || [];
            },

            // 完整状态访问（只读）
            get state() {
                return store.$state;
            },
        };
    }

    /**
     * 创建通知管理器
     */
    private createNotification(): INotification {
        const store = useNotificationStore();

        return {
            show(notification: any) {
                logger.info("📜 协调显示通知", notification);
                store.add(notification);
            },

            hide(id: string) {
                logger.info(`📜 协调隐藏通知: ${id}`);
                store.remove(id);
            },

            clear() {
                logger.info("📜 协调清空所有通知");
                store.clear();
            },

            get notifications() {
                return store.notifications;
            },
        };
    }

    /**
     * 创建照片管理器
     */
    private createPhotos(): IPhotos {
        const store = usePhotosStore();

        return {
            get currentPhoto() {
                // 暂时返回当前文件夹信息
                return store.currentFolder ? { folder: store.currentFolder } : null;
            },

            setCurrentPhoto(photo: any) {
                logger.info("📜 协调设置当前照片", photo);
                // 暂时使用setCurrentFolder
                if (photo?.folder) {
                    store.setCurrentFolder(photo.folder);
                }
            },

            get photos() {
                // 暂时返回当前文件夹的文件集合
                return Array.from(store.files.values()).flat();
            },
        };
    }

    /**
     * 计算偏好增量（业务逻辑）
     * ✅ 在人界读取Store当前状态，计算新的完整状态
     */
    private async computePreferenceDelta(zouzhe: Zouzhe): Promise<any> {
        const store = usePreferenceStore();

        switch (zouzhe.matter) {
            case ZOUZHE_MATTERS.ADD_PATH: {
                const path = zouzhe.content?.path;
                if (!path) throw new Error("路径参数缺失");

                // 读取当前paths，计算新数组
                const currentPaths = store.appState.paths || [];
                const newPaths = currentPaths.includes(path)
                    ? currentPaths // 已存在，不重复添加
                    : [...currentPaths, path]; // 添加新路径

                logger.debug(`📜 计算ADD_PATH增量: ${currentPaths.length} -> ${newPaths.length}`);

                // 返回完整的scanning.paths数组，不是操作
                return {
                    scanning: {
                        paths: newPaths,
                    },
                };
            }

            case ZOUZHE_MATTERS.REMOVE_PATH: {
                const path = zouzhe.content?.path;
                if (!path) throw new Error("路径参数缺失");

                // 读取当前paths，过滤掉要移除的路径
                const currentPaths = store.appState.paths || [];
                const newPaths = currentPaths.filter((p) => p !== path);

                // 同时过滤相关的scanningFolder（Store中的字段名）
                const currentScanningFolders = store.appState.scanningFolder || [];
                const newScanningFolders = currentScanningFolders.filter(
                    (folder: any) => !folder.path?.startsWith(path),
                );

                logger.debug(
                    `📜 计算REMOVE_PATH增量: paths ${currentPaths.length} -> ${newPaths.length}, scanningFolder ${currentScanningFolders.length} -> ${newScanningFolders.length}`,
                );

                // 返回完整的数组（注意：这里只返回paths，scanningFolder由Store内部管理）
                return {
                    scanning: {
                        paths: newPaths,
                    },
                };
            }

            case ZOUZHE_MATTERS.ADD_SCAN_FOLDER: {
                const { folder, action = "scan", source = "user" } = zouzhe.content || {};
                if (!folder) throw new Error("扫描文件夹参数缺失");

                // ADD_SCAN_FOLDER直接由Store的addScanFolder方法处理
                // 这里不需要计算delta，因为scanningFolder是Store内部管理的
                // 我们只是触发操作，不返回delta
                logger.debug(`📜 ADD_SCAN_FOLDER将由Store方法直接处理: ${folder}`);

                // 返回空delta，实际操作在applyDeltaToStore中调用store.addScanFolder
                return {
                    _scanFolderOperation: {
                        folder,
                        action,
                        source,
                    },
                };
            }

            default:
                throw new Error(`未知的路径操作类型: ${zouzhe.matter}`);
        }
    }

    /**
     * 将增量应用到Store（天界确认后）
     * ✅ 简单赋值，无业务逻辑
     */
    private applyDeltaToStore(delta: any): void {
        const store = usePreferenceStore();

        if (delta.scanning?.paths !== undefined) {
            // 直接替换paths数组
            store.appState.paths = delta.scanning.paths;
            logger.info(`📜 Store已更新: paths = [${delta.scanning.paths.join(", ")}]`);
        }

        // ADD_SCAN_FOLDER特殊处理：调用Store方法
        if (delta._scanFolderOperation) {
            const { folder, action, source } = delta._scanFolderOperation;
            store.addScanFolder(folder, action, source);
            logger.info(`📜 Store已更新: scanningFolder添加 ${folder} (${action})`);
        }
    }

    /**
     * 天界确认后更新本地Store
     * 确保人界和天界数据保持一致
     */
    private updateStoreAfterTianjieConfirmation(zouzhe: Zouzhe): void {
        const store = usePreferenceStore();

        switch (zouzhe.matter) {
            case ZOUZHE_MATTERS.ADD_PATH:
                if (zouzhe.content?.path) {
                    store.addPath(zouzhe.content.path);
                    logger.info(
                        `📜 天界确认成功，更新本地监控路径（添加）: ${zouzhe.content.path}`,
                    );
                }
                break;
            case ZOUZHE_MATTERS.REMOVE_PATH:
                if (zouzhe.content?.path) {
                    store.removePath(zouzhe.content.path);
                    logger.info(
                        `📜 天界确认成功，更新本地监控路径（移除）: ${zouzhe.content.path}`,
                    );
                }
                break;
            case ZOUZHE_MATTERS.ADD_SCAN_FOLDER:
                if (zouzhe.content?.folder) {
                    const { folder, action, source } = zouzhe.content;
                    store.addScanFolder(folder, action || "scan", source || "user");
                    logger.info(`📜 天界确认成功，更新本地扫描文件夹: ${folder} (${action})`);
                }
                break;
            case ZOUZHE_MATTERS.THEME_CHANGE:
                if (zouzhe.content?.themeId) {
                    store.setThemeId(zouzhe.content.themeId);
                    logger.info(`📜 天界确认成功，更新本地主题: ${zouzhe.content.themeId}`);
                }
                break;
            case ZOUZHE_MATTERS.LANGUAGE_CHANGE:
                if (zouzhe.content?.locale) {
                    store.setLocale(zouzhe.content.locale);
                    logger.info(`📜 天界确认成功，更新本地语言: ${zouzhe.content.locale}`);
                }
                break;
            case ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE:
                if (zouzhe.content?.size) {
                    store.updateThumbnailSize(zouzhe.content.size);
                    logger.info(`📜 天界确认成功，更新本地缩略图大小: ${zouzhe.content.size}`);
                }
                break;
        }
    }

    /**
     * 拆箱袁天罡响应 - 严格按ZhaolingResponse契约提取业务数据
     * 房玄龄职责：理解袁天罡的数据结构，提取纯业务数据
     */
    private unboxZhaolingResponse(zhaolingResponse: any): any {
        logger.info(`📜 开始拆箱袁天罡响应: ${zhaolingResponse.command}`);

        // 检查袁天罡响应基本状态
        if (!zhaolingResponse.acknowledged) {
            logger.error(`📜 袁天罡拒绝执行诏令: ${zhaolingResponse.error || "未知原因"}`);
            return null;
        }

        // 按照新的ZhaolingResponse契约，直接提取data字段
        const businessData = zhaolingResponse.data;

        logger.info(
            `📜 拆箱完成: ${businessData ? "有数据" : "无数据"}, 引擎: ${zhaolingResponse.metadata?.engineName || "unknown"}`,
        );
        return businessData;
    }

    /**
     * 装箱为宰相格式 - 严格按ZouzheResponse契约
     * 房玄龄职责：将业务数据包装为自己的响应格式
     */
    private reboxAsZouzheResponse(
        originalZouzhe: Zouzhe,
        businessData: any,
        zhaolingResponse: any,
        processTime: number,
        instruction: string,
    ): ZouzheResponse {
        logger.info(`📜 开始装箱为宰相格式: ${originalZouzhe.matter}`);

        // 如果天界确认成功，根据奏折类型更新本地Store
        if (zhaolingResponse.acknowledged) {
            const store = usePreferenceStore();

            switch (originalZouzhe.matter) {
                case ZOUZHE_MATTERS.GET_PREFERENCES:
                    // 获取偏好设置：使用纯函数实现智能合并逻辑
                    if (businessData && typeof businessData === "object") {
                        const mergedPreferences = mergePreferencesFromTianjie(
                            store.preferences,
                            businessData,
                        );
                        applyPreferencesToStore(store, mergedPreferences);
                        logger.info(`📜 天界偏好数据已加载并智能合并到本地Store`);
                    } else {
                        logger.warn(`📜 天界偏好数据为空，保持本地默认设置`);
                    }
                    break;
                case ZOUZHE_MATTERS.THEME_CHANGE:
                    if (originalZouzhe.content?.themeId) {
                        store.setThemeId(originalZouzhe.content.themeId);
                        logger.info(
                            `📜 天界确认成功，更新本地主题: ${originalZouzhe.content.themeId}`,
                        );
                    }
                    break;
                case ZOUZHE_MATTERS.LANGUAGE_CHANGE:
                    if (originalZouzhe.content?.locale) {
                        store.setLocale(originalZouzhe.content.locale);
                        logger.info(
                            `📜 天界确认成功，更新本地语言: ${originalZouzhe.content.locale}`,
                        );
                    }
                    break;
                case ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE:
                    if (originalZouzhe.content?.size) {
                        store.updateThumbnailSize(originalZouzhe.content.size);
                        logger.info(
                            `📜 天界确认成功，更新本地缩略图大小: ${originalZouzhe.content.size}`,
                        );
                    }
                    break;
                case ZOUZHE_MATTERS.ADD_PATH:
                    // 路径添加：天界确认后更新本地Store
                    if (originalZouzhe.content?.path) {
                        store.addPath(originalZouzhe.content.path);
                        logger.info(
                            `📜 天界确认成功，更新本地监控路径（添加）: ${originalZouzhe.content.path}`,
                        );
                    }
                    break;
                case ZOUZHE_MATTERS.REMOVE_PATH:
                    // 路径移除：天界确认后更新本地Store
                    if (originalZouzhe.content?.path) {
                        store.removePath(originalZouzhe.content.path);
                        logger.info(
                            `📜 天界确认成功，更新本地监控路径（移除）: ${originalZouzhe.content.path}`,
                        );
                    }
                    break;
                case ZOUZHE_MATTERS.ADD_SCAN_FOLDER:
                    // 扫描文件夹添加：天界确认后更新本地Store
                    if (originalZouzhe.content?.folder) {
                        const { folder, action, source } = originalZouzhe.content;
                        store.addScanFolder(folder, action || "scan", source || "user");
                        logger.info(`📜 天界确认成功，更新本地扫描文件夹: ${folder} (${action})`);
                    }
                    break;
            }
        }

        const officials = ["房玄龄"];
        if (zhaolingResponse.metadata?.engineName) {
            officials.push(`袁天罡-${zhaolingResponse.metadata.engineName}`);
        }

        const response: ZouzheResponse = {
            approved: zhaolingResponse.acknowledged,
            matter: originalZouzhe.matter,
            data: businessData, // 直接的业务数据，无嵌套
            instruction: zhaolingResponse.acknowledged
                ? `${instruction} - ${zhaolingResponse.blessing || "天界恩准"}`
                : `${instruction} - 执行失败`,
            timestamp: Date.now(),
            officials,
            metadata: {
                processTime: processTime + (zhaolingResponse.metadata?.processTime || 0),
                escalated: true,
                blessing: zhaolingResponse.blessing,
            },
        };

        logger.info(
            `📜 装箱完成: 批准=${response.approved}, 数据=${businessData ? "有" : "无"}, 总耗时=${response.metadata?.processTime}ms`,
        );
        return response;
    }

    /**
     * 判断是否为路径操作
     */
    private isPathOperation(matter: string): boolean {
        return [
            ZOUZHE_MATTERS.ADD_PATH,
            ZOUZHE_MATTERS.REMOVE_PATH,
            ZOUZHE_MATTERS.ADD_SCAN_FOLDER,
        ].includes(matter as any);
    }

    /**
     * 获取路径操作类型
     */
    private getPathOperationType(matter: string): string {
        switch (matter) {
            case ZOUZHE_MATTERS.ADD_PATH:
                return "addPath";
            case ZOUZHE_MATTERS.REMOVE_PATH:
                return "removePath";
            case ZOUZHE_MATTERS.ADD_SCAN_FOLDER:
                return "addScanFolder";
            default:
                throw new Error(`未知的路径操作类型: ${matter}`);
        }
    }

    /**
     * 提取路径操作数据
     */
    private extractPathOperationData(zouzhe: Zouzhe): any {
        switch (zouzhe.matter) {
            case ZOUZHE_MATTERS.ADD_PATH:
            case ZOUZHE_MATTERS.REMOVE_PATH:
                return zouzhe.content?.path;
            case ZOUZHE_MATTERS.ADD_SCAN_FOLDER:
                return {
                    path: zouzhe.content?.folder,
                    action: zouzhe.content?.action || "scan",
                    source: zouzhe.content?.source || "user",
                };
            default:
                return zouzhe.content;
        }
    }

    /**
     * 创建偏好服务代理，供策略使用
     * 这个代理将策略的调用转发到天界处理
     */
    private createPreferenceServiceProxy() {
        return {
            addPath: async (path: string) => {
                logger.debug("📜 文书司代为委办：路径添加文书上报天廷");
                await this.escalateToTianjie({
                    department: "策略执行器",
                    matter: ZOUZHE_MATTERS.ADD_PATH,
                    content: { path },
                    timestamp: Date.now(),
                    priority: ZOUZHE_PRIORITIES.NORMAL,
                });
            },

            removePath: async (path: string) => {
                logger.debug("📜 文书司代为委办：路径移除文书上报天廷");
                await this.escalateToTianjie({
                    department: "策略执行器",
                    matter: ZOUZHE_MATTERS.REMOVE_PATH,
                    content: { path },
                    timestamp: Date.now(),
                    priority: ZOUZHE_PRIORITIES.NORMAL,
                });
            },

            addScanFolder: async (folder: string, action: string, source: string) => {
                logger.debug("📜 文书司代为委办：扫描文件夹文书上报天廷");
                await this.escalateToTianjie({
                    department: "策略执行器",
                    matter: ZOUZHE_MATTERS.ADD_SCAN_FOLDER,
                    content: { folder, action, source },
                    timestamp: Date.now(),
                    priority: ZOUZHE_PRIORITIES.NORMAL,
                });
            },

            updateTheme: async (themeId: string) => {
                logger.debug("📜 文书司代为委办：主题变更文书上报天廷");
                await this.escalateToTianjie({
                    department: "策略执行器",
                    matter: ZOUZHE_MATTERS.THEME_CHANGE,
                    content: { themeId },
                    timestamp: Date.now(),
                    priority: ZOUZHE_PRIORITIES.NORMAL,
                });
            },

            updateLanguage: async (locale: string) => {
                logger.debug("📜 文书司代为委办：语言变更文书上报天廷");
                await this.escalateToTianjie({
                    department: "策略执行器",
                    matter: ZOUZHE_MATTERS.LANGUAGE_CHANGE,
                    content: { locale },
                    timestamp: Date.now(),
                    priority: ZOUZHE_PRIORITIES.NORMAL,
                });
            },

            updateThumbnailSize: async (size: number) => {
                logger.debug("📜 文书司代为委办：缩略图大小文书上报天廷");
                await this.escalateToTianjie({
                    department: "策略执行器",
                    matter: ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE,
                    content: { size },
                    timestamp: Date.now(),
                    priority: ZOUZHE_PRIORITIES.NORMAL,
                });
            },

            loadPreferences: async () => {
                logger.debug("📜 文书司代为委办：偏好设置文书上报天廷");
                await this.escalateToTianjie({
                    department: "策略执行器",
                    matter: ZOUZHE_MATTERS.GET_PREFERENCES,
                    content: {},
                    timestamp: Date.now(),
                    priority: ZOUZHE_PRIORITIES.NORMAL,
                });
            },
        };
    }

    /**
     * 将奏折上报天界处理（策略使用的简化方法）
     */
    private async escalateToTianjie(zouzhe: Zouzhe): Promise<void> {
        // 构造诏令上下文 - 路径操作需要特殊处理
        let zhaolingContext = zouzhe.content;

        // 路径操作转换为 pathOperations 格式
        if (this.isPathOperation(zouzhe.matter)) {
            zhaolingContext = {
                pathOperations: [
                    {
                        type: this.getPathOperationType(zouzhe.matter),
                        data: this.extractPathOperationData(zouzhe),
                        timestamp: zouzhe.timestamp,
                    },
                ],
            };
        }

        const zhaoling: Zhaoling = {
            command: zouzhe.matter, // 保持业务命令语义，袁天罡负责映射到工作流
            context: zhaolingContext,
            timestamp: Date.now(),
            source: zouzhe.department,
            priority: ZHAOLING_PRIORITIES.NORMAL,
            requiresTianshuApproval: true,
        };

        if (this._yuanTianGang) {
            await this._yuanTianGang.executeZhaoling(zhaoling);
        }
    }

    /**
     * 检查奏折是否为文书总管司可处理的类型
     * 实现Linus "好品味"：清晰的分类逻辑
     */
    private isStrategyHandledMatter(matter: string): boolean {
        const strategyHandledMatters = [
            ZOUZHE_MATTERS.GET_PREFERENCES,
            ZOUZHE_MATTERS.THEME_CHANGE,
            ZOUZHE_MATTERS.LANGUAGE_CHANGE,
            ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE,
            ZOUZHE_MATTERS.ADD_PATH,
            ZOUZHE_MATTERS.REMOVE_PATH,
            ZOUZHE_MATTERS.ADD_SCAN_FOLDER,
        ];
        return strategyHandledMatters.includes(matter as any);
    }

    /**
     * 获取奏折类型对应的指令说明
     */
    private getInstructionForMatter(matter: string): string {
        switch (matter) {
            case ZOUZHE_MATTERS.NOTIFICATION_SHOW:
            case ZOUZHE_MATTERS.PHOTO_SWITCH:
                return "内政事务，宰相直接处理";
            default:
                return "常规事务内部处理";
        }
    }

    /**
     * 判断奏折是否需要上报天界
     */
    private shouldEscalateToTianjie(matter: string, priority: string): boolean {
        // 文书总管司处理的事务已经在文书处理中上报
        if (this.isStrategyHandledMatter(matter)) {
            return false;
        }
        // 其他紧急事务需要上报
        return priority === ZOUZHE_PRIORITIES.URGENT;
    }
}
