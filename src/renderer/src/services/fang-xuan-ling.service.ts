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
} from "../interfaces/fang-xuan-ling.interface";
import type { IYuanTianGangService } from "../interfaces/yuan-tian-gang.interface";
import {
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
    ZHAOLING_PRIORITIES,
    ERROR_MESSAGES,
    GUANYUAN_NAMES,
} from "../interfaces/fang-xuan-ling.interface";
import { usePreferenceStore } from "../stores/preference";
import { useNotificationStore } from "../stores/notification";
import { usePhotosStore } from "../stores/photos";
import { loggers } from "@common/logger";

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

        logger.info("📜 已完成各部门管理器初始化");
    }

    /**
     * 初始化朝廷政务 - 从天界加载偏好设置
     * 房玄龄上任后，需要从天界获取之前的政务记录
     */
    async initializeGovernance(): Promise<void> {
        logger.info("📜 开始初始化朝廷政务，准备从天界获取历史记录");

        try {
            // 向袁天罡发送诏令，请求获取偏好设置
            const zhaoling: Zhaoling = {
                command: "获取朝廷偏好记录",
                context: {
                    action: "get_preferences",
                    department: "褚遂良文书部",
                    purpose: "初始化朝廷政务",
                },
                timestamp: Date.now(),
                source: GUANYUAN_NAMES.CHU_SUILIANG,
                priority: ZHAOLING_PRIORITIES.URGENT,
            };

            const response = await this._yuanTianGang.executeZhaoling(zhaoling);

            if (response.result?.tianShuResponse?.success) {
                const preferences = response.result.tianShuResponse.data;

                // 通知褚遂良更新偏好设置
                const preferenceStore = usePreferenceStore();

                if (preferences?.ui) {
                    if (preferences.ui.theme) {
                        preferenceStore.setThemeId(preferences.ui.theme);
                        logger.info("📜 已更新主题设置:", preferences.ui.theme);
                    }
                    if (preferences.ui.language) {
                        preferenceStore.setLocale(preferences.ui.language);
                        logger.info("📜 已更新语言设置:", preferences.ui.language);
                    }
                }

                if (preferences?.display?.thumbnailSize) {
                    preferenceStore.updateThumbnailSize(preferences.display.thumbnailSize);
                    logger.info("📜 已更新缩略图大小:", preferences.display.thumbnailSize);
                }

                logger.info("📜 朝廷政务初始化完成，已从天界同步偏好设置");
            } else {
                logger.warn("📜 未能从天界获取偏好设置，使用本地默认值");
            }
        } catch (error) {
            logger.error("📜 初始化朝廷政务失败:", error);
            // 失败时使用本地默认值，不影响应用启动
        }
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
            // 处理奏折逻辑
            let needsEscalation = false;
            let instruction = "";

            // 根据事务类型决定是否需要上报天界
            switch (zouzhe.matter) {
                case ZOUZHE_MATTERS.GET_PREFERENCES:
                    // 获取偏好设置，直接调用初始化政务方法
                    await this.initializeGovernance();
                    needsEscalation = false;
                    instruction = "已从天界获取偏好设置并同步到本地";
                    break;
                case ZOUZHE_MATTERS.THEME_CHANGE:
                case ZOUZHE_MATTERS.LANGUAGE_CHANGE:
                    needsEscalation = true;
                    instruction = "重大偏好变更，需上报天界记录";
                    break;
                case ZOUZHE_MATTERS.NOTIFICATION_SHOW:
                case ZOUZHE_MATTERS.PHOTO_SWITCH:
                    needsEscalation = false;
                    instruction = "内政事务，宰相直接处理";
                    break;
                default:
                    needsEscalation = zouzhe.priority === ZOUZHE_PRIORITIES.URGENT;
                    instruction = needsEscalation ? "紧急事务上报天界" : "常规事务内部处理";
            }

            // 如果需要上报天界，发送诏令给袁天罡
            if (needsEscalation) {
                const zhaoling: Zhaoling = {
                    command: `${zouzhe.matter}`,
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
                    logger.info(`📜 发布诏令: ${zhaoling.command}`);
                    const zhaolingResponse = await this._yuanTianGang.executeZhaoling(zhaoling);
                    logger.info(`📜 诏令发布结果:`, zhaolingResponse);
                } else {
                    logger.warn("📜 袁天罡服务未注入，无法上报天界");
                }
            }

            const response: ZouzheResponse = {
                approved: true,
                matter: zouzhe.matter,
                content: zouzhe.content,
                timestamp: Date.now(),
                instruction,
                needsEscalation,
            };

            logger.info(`房玄龄批复奏折: ${zouzhe.matter}`, response);
            return response;
        } catch (error) {
            logger.error(`奏折处理失败: ${zouzhe.matter}`, error);

            return {
                approved: false,
                matter: zouzhe.matter,
                content: zouzhe.content,
                timestamp: Date.now(),
                instruction: `${ERROR_MESSAGES.PROCESSING_FAILED}: ${error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR}`,
                needsEscalation: false,
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
        logger.warn("房玄龄执行全局重置");

        // 调用各store的重置方法
        const preferenceStore = usePreferenceStore();
        const notificationStore = useNotificationStore();
        const photosStore = usePhotosStore();

        preferenceStore.$reset();
        notificationStore.$reset();
        photosStore.$reset();

        logger.info("房玄龄已完成全局重置");
    }

    /**
     * 创建偏好管理器
     */
    private createPreference(): IPreference {
        const store = usePreferenceStore();

        const updateTheme = (themeId: string) => {
            logger.info(`📜 保存用户偏好主题: ${themeId}`);
            store.setThemeId(themeId);

            // 事后向房玄龄汇报（异步）
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.THEME_SETTINGS,
                matter: ZOUZHE_MATTERS.THEME_CHANGE,
                content: { themeId },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            // 向房玄龄汇报主题变更
            this.processZouzhe(zouzhe).catch((error: Error) => {
                logger.warn("📜 奏折汇报失败", error);
            });
        };

        const updateLanguage = (locale: string) => {
            logger.info(`📜 更换语言: ${locale}`);
            store.setLocale(locale);

            // 事后向房玄龄汇报（异步）
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.LANGUAGE_SETTINGS,
                matter: ZOUZHE_MATTERS.LANGUAGE_CHANGE,
                content: { locale },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            // 向房玄龄汇报语言变更
            this.processZouzhe(zouzhe).catch((error: Error) => {
                logger.warn("📜 汇报语言变更失败", error);
            });
        };

        return {
            // 主题管理
            get currentTheme() {
                return store.themeId;
            },

            async updateTheme(themeId: string) {
                return updateTheme(themeId);
            },

            // 语言管理
            get currentLanguage() {
                return store.locale;
            },

            async updateLanguage(locale: string) {
                return updateLanguage(locale);
            },

            // 暗色模式
            get isDarkMode() {
                return store.darkMode;
            },

            toggleDarkMode() {
                const newMode = !store.darkMode;
                logger.info(`📜 协调切换暗色模式: ${newMode}`);
                store.darkMode = newMode;
            },

            // 缩略图大小
            get thumbnailSize() {
                return store.thumbnailSize;
            },

            setThumbnailSize(size: number) {
                logger.info(`📜 协调设置缩略图大小: ${size}`);
                store.thumbnailSize = size;
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
}
