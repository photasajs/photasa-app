/**
 * 房玄龄服务构建器（Service Builders）
 *
 * 职责：
 * - 为房玄龄宰相构建各类专职官员（服务接口）
 * - 提供统一的服务创建和配置入口
 * - 封装Store访问逻辑，遵循访问器模式
 *
 * 设计理念：
 * 如同朝廷设官分职，房玄龄作为宰相，统筹各部门官员，
 * 每位官员各司其职，术业有专攻。
 */

import type {
    IPreference,
    INotification,
    IPhotos,
} from "../../interfaces/fang-xuan-ling.interface";
import { usePreferenceStore } from "../../stores/preference";
import { useNotificationStore } from "../../stores/notification";
import { usePhotosStore } from "../../stores/photos";
import { loggers } from "@common/logger";

const logger = loggers.app;

/**
 * 创建偏好管理器（设立中书省官员）
 *
 * 职责：管理应用偏好设置，包括主题、语言、路径等配置
 *
 * @returns IPreference接口实现
 */
export function createPreferenceService(): IPreference {
    const store = usePreferenceStore();

    // 注意：主题和语言更新现在应该通过褚遂良的奏折链路处理
    // 房玄龄只负责处理奏折并与天界通信，不直接操作典籍
    // 典籍更新应在天界响应后由相应的处理机制完成

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
 * 创建通知管理器（设立宣传司官员）
 *
 * 职责：管理应用通知，包括显示、隐藏和清除告示
 *
 * @returns INotification接口实现
 */
export function createNotificationService(): INotification {
    const store = useNotificationStore();

    return {
        show(notification: unknown) {
            logger.info("🔔 鸣钟击鼓，传令天下", notification);
            store.add(notification);
        },

        hide(id: string) {
            logger.info(`🔔 撤销告示，销毁公文：${id}`);
            store.remove(id);
        },

        clear() {
            logger.info("🔔 清除所有告示，府门焕然一新");
            store.clear();
        },

        get notifications() {
            return store.notifications;
        },
    };
}

/**
 * 创建照片管理器（设立典藏司官员）
 *
 * 职责：管理照片数据，包括当前照片和照片集合
 *
 * @returns IPhotos接口实现
 */
export function createPhotosService(): IPhotos {
    const store = usePhotosStore();

    return {
        get currentPhoto() {
            // 暂时返回当前文件夹信息
            return store.currentFolder ? { folder: store.currentFolder } : null;
        },

        setCurrentPhoto(photo: unknown) {
            logger.info("📚 典藏司：更换展示画卷", photo);
            // 暂时使用setCurrentFolder
            if (photo && typeof photo === "object" && "folder" in photo) {
                store.setCurrentFolder((photo as { folder: string }).folder);
            }
        },

        get photos() {
            // 暂时返回当前文件夹的文件集合
            return Array.from(store.files.values()).flat() as unknown as Record<string, unknown>[];
        },
    };
}
