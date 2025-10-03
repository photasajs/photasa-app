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
                    // 获取偏好设置，需要上报天界获取
                    needsEscalation = true;
                    instruction = "需向天界获取偏好设置";
                    break;
                case ZOUZHE_MATTERS.THEME_CHANGE:
                    // 褚遂良的主题变更奏折 - 直接上报天界，等待天界确认后再更新Store
                    needsEscalation = true;
                    instruction = "主题偏好变更，需上报天界记录并等待确认";
                    logger.info(`📜 房玄龄转发褚遂良主题变更奏折: ${zouzhe.content?.themeId}`);
                    break;
                case ZOUZHE_MATTERS.LANGUAGE_CHANGE:
                    // 褚遂良的语言变更奏折 - 直接上报天界，等待天界确认后再更新Store
                    needsEscalation = true;
                    instruction = "语言偏好变更，需上报天界记录并等待确认";
                    logger.info(`📜 房玄龄转发褚遂良语言变更奏折: ${zouzhe.content?.locale}`);
                    break;
                case ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE:
                    // 褚遂良的缩略图大小变更奏折 - 直接上报天界，等待天界确认后再更新Store
                    needsEscalation = true;
                    instruction = "缩略图大小偏好变更，需上报天界记录并等待确认";
                    logger.info(`📜 房玄龄转发褚遂良缩略图大小变更奏折: ${zouzhe.content?.size}`);
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
                    const startTime = Date.now();
                    logger.info(`📜 发布诏令: ${zhaoling.command}, 来源: ${zhaoling.source}`);

                    const zhaolingResponse = await this._yuanTianGang.executeZhaoling(zhaoling);
                    const processTime = Date.now() - startTime;

                    // 房玄龄职责：拆箱袁天罡响应，装箱为宰相格式
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
                } else {
                    logger.warn("📜 袁天罡服务未注入，无法上报天界");
                }
            }

            // 不需要上报天界的情况，直接返回宰相处理结果
            const response: ZouzheResponse = {
                approved: true,
                matter: zouzhe.matter,
                data: zouzhe.content, // 直接业务数据
                instruction,
                timestamp: Date.now(),
                metadata: {
                    processTime: 0,
                    escalated: false,
                },
            };

            logger.info(`房玄龄批复奏折: ${zouzhe.matter}`, response);
            return response;
        } catch (error) {
            logger.error(`奏折处理失败: ${zouzhe.matter}`, error);

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
}
