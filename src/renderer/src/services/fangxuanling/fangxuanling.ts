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
    ZOUZHE_MATTERS,
} from "../../interfaces/fang-xuan-ling.interface";
import { usePreferenceStore } from "../../stores/preference";
import { useNotificationStore } from "../../stores/notification";
import { usePhotosStore } from "../../stores/photos";
import { loggers } from "@common/logger";
import { loadMatterSyncConfig, type MatterSyncMetadata, getStoreByPath } from "./store-automation";
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
        logger.info("🏛️ 房玄龄就任宰相，统筹朝政");

        // 加载Store自动同步配置
        this._matterSyncConfig = loadMatterSyncConfig();
        logger.info("📚 朝廷典章制度已备");

        // 初始化各部门管理器
        this._preference = this.createPreference();
        this._notification = this.createNotification();
        this._photos = this.createPhotos();

        logger.info("🏛️ 六部百官各司其职");
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

    /**
     * 计算paths相关matter的delta
     * 房玄龄负责业务逻辑：根据当前paths数组计算新的完整数组
     *
     * @param matter - 奏折事项（add_path或remove_path）
     * @param content - 奏折内容（包含单个path）
     * @returns PreferenceDelta对象或null
     */
    private computePathsDelta(
        matter: string,
        content: Record<string, unknown>,
    ): Record<string, unknown> | null {
        if (matter === ZOUZHE_MATTERS.ADD_PATH) {
            const store = usePreferenceStore();
            const currentPaths = store.preferences?.scanning?.paths || [];
            const newPath = content.path as string;

            logger.debug(`📚 房玄龄计算添加路径delta: ${newPath}`);
            logger.debug(`📚 当前paths数量: ${currentPaths.length}`);

            return {
                scanning: {
                    paths: [...currentPaths, newPath],
                },
            };
        }

        if (matter === ZOUZHE_MATTERS.REMOVE_PATH) {
            const store = usePreferenceStore();
            const currentPaths = store.preferences?.scanning?.paths || [];
            const pathToRemove = content.path as string;

            logger.debug(`📚 房玄龄计算移除路径delta: ${pathToRemove}`);
            logger.debug(`📚 当前paths数量: ${currentPaths.length}`);

            return {
                scanning: {
                    paths: currentPaths.filter((p) => p !== pathToRemove),
                },
            };
        }

        return null;
    }

    async processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse> {
        logger.info(`📝 收到${zouzhe.department}奏章: ${zouzhe.matter}`, zouzhe);

        try {
            const startTime = Date.now();

            // 特殊处理：paths matter需要计算完整delta
            let context = zouzhe.content || {};
            if (
                zouzhe.matter === ZOUZHE_MATTERS.ADD_PATH ||
                zouzhe.matter === ZOUZHE_MATTERS.REMOVE_PATH
            ) {
                const pathsDelta = this.computePathsDelta(zouzhe.matter, zouzhe.content || {});
                if (pathsDelta) {
                    context = pathsDelta; // 使用计算后的完整delta
                    logger.info(
                        `📚 房玄龄已计算paths delta，新paths数组长度: ${(pathsDelta.scanning as any)?.paths?.length || 0}`,
                    );
                }
            }

            // 统一流程：所有matter都走同样的流程
            // 1. 构造诏令上报天界
            const zhaoling: Zhaoling = {
                command: zouzhe.matter,
                context: context, // 使用处理后的context
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
                    // ✅ RFC 0038: 使用Store注册表动态获取Store，不再硬编码
                    const store = getStoreByPath(syncMetadata.storePath);
                    if (store) {
                        syncStoreWithSnapshot(zouzhe.matter, zhaolingResponse, syncMetadata, store);
                    } else {
                        logger.error(
                            `❌ 典籍归档失败: 未找到册库「${syncMetadata.storePath}」办理「${zouzhe.matter}」`,
                        );
                    }
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

            logger.info(`📝 奏章已批: ${zouzhe.matter}, 耗时: ${processTime}ms`);
            return response;
        } catch (error) {
            logger.error(`❌ 奏疏有误，退回重拟: ${zouzhe.matter}`, error);

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
                logger.info("🔔 鸣钟击鼓，传令天下", notification);
                store.add(notification);
            },

            hide(id: string) {
                logger.info(`🔔 撤销告示: ${id}`);
                store.remove(id);
            },

            clear() {
                logger.info("🔔 清除所有告示");
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
                logger.info("📚 协调设置当前照片", photo);
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
