/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Store注册表 - Store Automation的核心映射
 *
 * 遵循配置驱动原则：
 * - matter-sync.yml中的storePath字段决定使用哪个Store
 * - 此注册表提供storePath到Pinia Store composable的映射
 * - 支持动态扩展，新增Store只需添加注册表项
 */

import { usePreferenceStore } from "@renderer/stores/preference";
import { useNotificationStore } from "@renderer/stores/notification";
import { usePhotosStore } from "@renderer/stores/photos";
import { useScanningStore } from "../stores/scanning-store";
import { useAppStateStore } from "../stores/appstate-store";
import { loggers } from "@photasa/common";

const logger = loggers.fangxuanling;

/**
 * Store工厂函数类型
 * 返回Pinia Store实例
 */
type StoreFactory = () => any;

/**
 * Store注册表类型
 * 键为storePath的根名称（如"preferences"、"notification"）
 * 值为Store composable函数
 */
export type StoreRegistry = Record<string, StoreFactory>;

/**
 * 全局Store注册表
 * 映射storePath到对应的Pinia Store composable
 *
 * ✅ RFC 0042 Step 1: 添加ScanningStore注册
 */
const STORE_REGISTRY: StoreRegistry = {
    preferences: usePreferenceStore,
    notification: useNotificationStore,
    photos: usePhotosStore,
    scanning: useScanningStore, // ✅ RFC 0042: ScanningStore注册
    appState: useAppStateStore, // ✅ RFC 0042: AppStateStore注册
};

/**
 * 从storePath提取Store名称（纯函数）
 *
 * 示例：
 * - "preferences" -> "preferences"
 * - "preferences.ui.theme" -> "preferences"
 * - "notification" -> "notification"
 *
 * @param storePath - Store路径（可能包含嵌套路径）
 * @returns Store名称（注册表中的键）
 */
export function extractStoreName(storePath: string): string {
    return storePath.split(".")[0];
}

/**
 * 根据storePath获取对应的Store实例
 *
 * @param storePath - Store路径（如"preferences"、"notification"等）
 * @returns Store实例，如果未找到则返回null
 */
export function getStoreByPath(storePath: string): any | null {
    const storeName = extractStoreName(storePath);
    const storeFactory = STORE_REGISTRY[storeName];

    if (!storeFactory) {
        logger.error(
            `❌ 未找到Store: ${storeName}，可用Store: ${Object.keys(STORE_REGISTRY).join(", ")}`,
        );
        return null;
    }

    logger.debug(`📚 获取Store: ${storeName}`);
    return storeFactory();
}

/**
 * 检查storePath是否有效（纯函数）
 *
 * @param storePath - Store路径
 * @returns 是否有效
 */
export function isValidStorePath(storePath: string): boolean {
    const storeName = extractStoreName(storePath);
    return storeName in STORE_REGISTRY;
}
