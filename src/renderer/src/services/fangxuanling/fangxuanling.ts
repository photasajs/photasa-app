/**
 * 房玄龄宰相服务实现
 * 唐朝宰相统筹所有政务部门，为UI组件提供统一接口
 */

import type {
    IFangXuanLingService,
    IPreference,
    INotification,
    IPhotos,
    IScanning,
    IAppState,
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
import { loggers } from "@common/logger";
import { loadMatterSyncConfig, type MatterSyncMetadata, getStoreByPath } from "./store-automation";
import { syncStoreWithSnapshot } from "./store-automation/store-sync-utils";
import {
    createPreferenceService,
    createNotificationService,
    createPhotosService,
    createScanningService,
    createAppStateService,
} from "./accessors/service-builders";

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
    private _appState: IAppState;
    private _notification: INotification;
    private _photos: IPhotos;
    private _yuanTianGang!: IYuanTianGangService;
    private _matterSyncConfig: Record<string, MatterSyncMetadata>;
    /**
     * ScanningStore访问器
     * ✅ RFC 0042 Step 1: 通过访问器模式访问ScanningStore
     */
    private _scanning: IScanning;

    constructor(yuanTianGang: IYuanTianGangService) {
        if (!yuanTianGang) {
            throw new Error("袁天罡钦天监服务未注入");
        }

        this._yuanTianGang = yuanTianGang;
        logger.info("🏛️ 房玄龄就任宰相，统筹朝政");

        // 加载Store自动同步配置
        this._matterSyncConfig = loadMatterSyncConfig();
        logger.info("📚 朝廷典章制度已备");

        // 初始化各部门管理器（使用独立的builder函数）
        this._preference = createPreferenceService();
        this._notification = createNotificationService();
        this._photos = createPhotosService();
        this._scanning = createScanningService();
        this._appState = createAppStateService();

        logger.info("🏛️ 房玄龄：扫描队列Store已就绪");
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
     * 应用状态访问器
     * ✅ RFC 0042 Step 2.5: 通过访问器模式访问AppStateStore
     */
    get appState(): IAppState {
        return this._appState;
    }

    /**
     * 扫描队列访问器
     * ✅ RFC 0042 Step 1: 通过访问器模式访问ScanningStore
     */
    get scanning(): IScanning {
        return this._scanning;
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
            const currentPaths = store?.scanning?.paths || [];
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
            const currentPaths = store?.scanning?.paths || [];
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
                    context = pathsDelta;
                    logger.info(
                        `📚 房玄龄已计算paths delta，新paths数组长度: ${(pathsDelta.scanning as Record<string, unknown> | undefined)?.paths ? ((pathsDelta.scanning as Record<string, unknown>).paths as unknown[]).length : 0}`,
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
                    // ✅ RFC 0042: storePath → storeName (Linus "好品味"设计)
                    const store = getStoreByPath(syncMetadata.storeName);
                    if (store) {
                        syncStoreWithSnapshot(zouzhe.matter, zhaolingResponse, syncMetadata, store);
                    } else {
                        logger.error(
                            `❌ 典籍归档失败: 未找到册库「${syncMetadata.storeName}」办理「${zouzhe.matter}」`,
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

    resetAll() {
        logger.warn("🏛️ 朝廷下令，重整朝纲");

        // 调用各store的重置方法
        this._preference.reset();
        this._notification.reset();
        this._photos.reset();
        this._scanning.reset();
        this._appState.reset();

        logger.info("🏛️ 重整朝纲已毕，百官归位");
    }
}
