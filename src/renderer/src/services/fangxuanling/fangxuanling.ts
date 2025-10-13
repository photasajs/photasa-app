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
    ZOUZHE_PRIORITIES,
    ZHAOLING_PRIORITIES,
    ERROR_MESSAGES,
} from "../../interfaces/fang-xuan-ling.interface";
import { usePreferenceStore } from "../../stores/preference";
import { useNotificationStore } from "../../stores/notification";
import { usePhotosStore } from "../../stores/photos";
import { loggers } from "@common/logger";
import { loadMatterSyncConfig, type MatterSyncMetadata } from "./store-automation";
import { syncStoreWithSnapshot } from "./store-automation/store-sync-utils";

const logger = loggers.fangxuanling;

/**
 * 房玄龄宰相响应消息常量
 */
const RESPONSE_MESSAGES = {
    DEFAULT_BLESSING: "天界恩准",
    EXECUTION_FAILED: "执行失败",
    UNKNOWN_ENGINE: "未知",
    OFFICIAL_FANGXUANLING: "房玄龄",
} as const;

/**
 * 房玄龄宰相服务实现
 * 统筹管理所有Store，提供统一API接口
 */
export class FangXuanLingService implements IFangXuanLingService {
    private _preference: IPreference;
    private _notification: INotification;
    private _photos: IPhotos;
    private _yuanTianGang!: IYuanTianGangService;
    private _matterSyncConfig: Record<string, MatterSyncMetadata>;

    constructor(yuanTianGang: IYuanTianGangService) {
        if (!yuanTianGang) {
            throw new Error("袁天罡钦天监服务未注入");
        }

        this._yuanTianGang = yuanTianGang;
        logger.info("📜 就任，开始统筹政务");

        // 加载Store自动同步配置
        this._matterSyncConfig = loadMatterSyncConfig();
        logger.info("📜 Store自动同步配置已加载");

        // 初始化各部门管理器
        this._preference = this.createPreference();
        this._notification = this.createNotification();
        this._photos = this.createPhotos();

        logger.info("📜 各部门管理器初始化完成");
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
            const startTime = Date.now();

            // 统一流程：所有matter都走同样的流程
            // 1. 构造诏令上报天界
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

            // 2. 执行诏令，天界处理
            const zhaolingResponse = await this._yuanTianGang.executeZhaoling(zhaoling);
            const processTime = Date.now() - startTime;

            // 3. 天界确认成功后，自动同步Store
            if (zhaolingResponse.acknowledged) {
                const syncMetadata = this._matterSyncConfig[zouzhe.matter];
                if (syncMetadata?.autoSync) {
                    const store = usePreferenceStore();
                    syncStoreWithSnapshot(zouzhe.matter, zhaolingResponse, syncMetadata, store);
                }
            }

            // 4. 构造响应
            const response: ZouzheResponse = {
                approved: zhaolingResponse.acknowledged,
                matter: zouzhe.matter,
                data: zhaolingResponse.data,
                instruction: zhaolingResponse.acknowledged
                    ? `${zhaolingResponse.blessing || RESPONSE_MESSAGES.DEFAULT_BLESSING}`
                    : RESPONSE_MESSAGES.EXECUTION_FAILED,
                timestamp: Date.now(),
                officials: [
                    RESPONSE_MESSAGES.OFFICIAL_FANGXUANLING,
                    `袁天罡-${zhaolingResponse.metadata?.engineName || RESPONSE_MESSAGES.UNKNOWN_ENGINE}`,
                ],
                metadata: {
                    processTime: processTime + (zhaolingResponse.metadata?.processTime || 0),
                    escalated: true,
                    blessing: zhaolingResponse.blessing,
                },
            };

            logger.info(`📜 奏折处理完成: ${zouzhe.matter}, 耗时: ${processTime}ms`);
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

            /**
             * 路径管理 - 只读访问
             * ✅ RFC 0038: 从preferences.scanning.paths访问，而非appState.paths
             */
            get paths() {
                return store.preferences.scanning.paths || [];
            },

            // 完整状态访问（只读）
            get state() {
                return store.$state as unknown as Record<string, unknown>;
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
                return Array.from(store.files.values()).flat() as unknown as Record<
                    string,
                    unknown
                >[];
            },
        };
    }
}
