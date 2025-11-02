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
    IScanning,
    IAppState,
} from "@renderer/interfaces/fang-xuan-ling.interface";
import { usePreferenceStore } from "@renderer/stores/preference";
import { useNotificationStore } from "@renderer/stores/notification";
import { useScanningStore } from "../stores/scanning-store";
import { usePhotosStore } from "@renderer/stores/photos";
import { loggers } from "@common/logger";
import type { ScanAction } from "@common/scan-types";
import type { NotificationConfig } from "@renderer/types/notification";
import { useAppStateStore } from "../stores/appstate-store";
import type { FolderNode } from "@common/folder-types";
const logger = loggers.fangxuanling;

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
            return store.ui.theme;
        },

        // 语言管理
        get currentLanguage() {
            return store.ui.language;
        },

        // 缩略图大小 - 只读访问
        get thumbnailSize() {
            return store.display.thumbnailSize;
        },

        /**
         * 路径管理 - 只读访问
         * ✅ RFC 0038: 从preferences.scanning.paths访问，而非appState.paths
         */
        get paths() {
            return store.scanning.paths || [];
        },

        /**
         * 重置偏好管理器
         * 清空偏好设置
         */
        reset() {
            store.$reset();
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
            store.add(notification as NotificationConfig);
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

        reset() {
            store.$reset();
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

        /**
         * 重置照片管理器
         * 清空当前文件夹和文件集合
         */
        reset() {
            store.$reset();
        },
    };
}

/**
 * ScanningStore访问器实现
 *
 * ✅ RFC 0042 Step 1: 只读访问器模式
 * ⚠️ 所有修改操作必须通过processZouzhe()提交奏折，不在此处提供
 */
export function createScanningService(): IScanning {
    const store = useScanningStore();

    return {
        /**
         * 查阅扫描队列（响应式引用）
         * 如同翻阅典籍目录，只可查看不可改动
         *
         * ✅ RFC 0042: 返回响应式数组引用，而非副本
         * 这样Vue computed可以正确追踪数组变化
         */
        get queue(): ScanAction[] {
            return store.queue;
        },

        /**
         * 查询队列大小
         * 统计待处理卷宗数量
         */
        get queueSize(): number {
            return store.queueSize;
        },

        /**
         * 查询处理状态
         * 了解当前是否有官员正在审阅卷宗
         */
        get isProcessing(): boolean {
            return store.isProcessing;
        },

        /**
         * 查询当前处理路径
         * 了解当前正在审阅哪份卷宗
         */
        get currentPath(): string | null {
            return store.currentPath;
        },

        /**
         * 查询下一个待处理任务
         * 预览待审卷宗中的下一份
         */
        get nextScanAction(): ScanAction | null {
            return store.nextScanAction;
        },

        /**
         * 检查路径是否在队列中（只读查询）
         * 查验某条路径是否已登记在册
         */
        isInQueue(path: string): boolean {
            return store.isInQueue(path);
        },
        reset() {
            store.$reset();
        },
    };
}

/**
 * AppState访问器实现
 *
 * ✅ RFC 0042 Step 2.5: 完整appState访问器
 * 提供对folderTree、currentFolder、lastOpenedFolder的只读访问
 *
 * ⚠️ 所有修改操作必须通过魏征服务的奏折链路处理
 */
export function createAppStateService(): IAppState {
    const store = useAppStateStore();

    return {
        /**
         * 查阅文件夹树（响应式引用）
         * 如同翻阅典籍目录，只可查看不可改动
         *
         * ✅ RFC 0042 Step 2.5: 返回响应式数组引用
         * 这样Vue computed可以正确追踪数组变化
         */
        get folderTree(): FolderNode[] {
            // 🔧 防御性编程：确保folderTree不为undefined或null
            const tree = store.folderTree;
            return tree && Array.isArray(tree) ? tree : [];
        },

        /**
         * 查询当前文件夹路径（只读）
         * 了解用户当前浏览的文件夹位置
         */
        get currentFolder(): string {
            return store.currentFolder;
        },

        /**
         * 查询最后打开的文件夹路径（只读）
         * 了解用户最后一次访问的文件夹位置
         */
        get lastOpenedFolder(): string {
            return store.lastOpenedFolder;
        },

        /**
         * 重置appState
         * 清空应用状态
         */
        reset() {
            store.$reset();
        },
    };
}
