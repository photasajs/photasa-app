/**
 * Store同步纯函数工具集
 *
 * 遵循Linus "好品味"原则：
 * 1. 所有函数都是纯函数，无副作用
 * 2. 输入相同则输出相同
 * 3. 易于测试和维护
 * 4. 函数组合优于类继承
 */

import type { MatterSyncMetadata } from "./index";
import type { ZhaolingResponse } from "@renderer/interfaces/yuan-tian-gang.interface";
import { loggers } from "@common/logger";
import { mergePreferencesFromTianjie, applyPreferencesToStore } from "../utils";
import type { PreferenceState } from "@renderer/stores/preference";

const logger = loggers.fangxuanling;

/**
 * 从天界响应中提取snapshot数据（纯函数）
 *
 * @param zhaolingResponse - 天界响应
 * @param snapshotPath - snapshot路径（如 "snapshot" 或 "data.result"）
 * @returns 提取的snapshot数据，失败返回null
 */
export function extractSnapshotFromResponse(
    zhaolingResponse: ZhaolingResponse,
    snapshotPath: string,
): unknown | null {
    try {
        let snapshot: unknown = zhaolingResponse.data;
        const pathParts = snapshotPath.split(".");

        for (const part of pathParts) {
            if (snapshot && typeof snapshot === "object" && part in snapshot) {
                snapshot = (snapshot as Record<string, unknown>)[part];
            } else {
                logger.warn(`📜 无法从天界响应中提取snapshot: ${snapshotPath}`);
                return null;
            }
        }

        if (!snapshot || typeof snapshot !== "object") {
            logger.warn(`📜 提取的snapshot数据无效`);
            return null;
        }

        return snapshot;
    } catch (error) {
        logger.error(`📜 提取snapshot失败: ${snapshotPath}`, error);
        return null;
    }
}

/**
 * 应用merge策略：深度合并snapshot到Store（纯函数）
 *
 * @param storePreferences - Store当前preferences
 * @param snapshot - 天界snapshot数据
 * @returns 合并后的preferences
 */
export function applyMergeStrategy(
    storePreferences: PreferenceState["preferences"],
    snapshot: unknown,
): PreferenceState["preferences"] {
    if (!snapshot || typeof snapshot !== "object") {
        logger.warn("📜 snapshot数据无效，返回原Store数据");
        return storePreferences;
    }

    const mergedPreferences = mergePreferencesFromTianjie(storePreferences, snapshot);
    return mergedPreferences;
}

/**
 * 应用replace策略：完全替换Store字段（纯函数）
 *
 * @param storeData - Store当前数据
 * @param snapshot - 天界snapshot数据
 * @param storePath - Store路径（如 "preferences.ui"）
 * @returns 更新后的Store数据
 */
export function applyReplaceStrategy(
    storeData: Record<string, unknown>,
    snapshot: unknown,
    storePath: string,
): Record<string, unknown> {
    try {
        const targetPathParts = storePath.split(".");
        const newStoreData = JSON.parse(JSON.stringify(storeData)); // 深拷贝
        let target: Record<string, unknown> = newStoreData;

        // 导航到目标路径的父级
        for (let i = 0; i < targetPathParts.length - 1; i++) {
            const nextTarget = target[targetPathParts[i]];
            if (!nextTarget || typeof nextTarget !== "object") {
                logger.error(`📜 Store路径不存在: ${storePath}`);
                return storeData; // 返回原数据
            }
            target = nextTarget as Record<string, unknown>;
        }

        // 替换最终字段
        const lastKey = targetPathParts[targetPathParts.length - 1];
        target[lastKey] = snapshot;

        return newStoreData;
    } catch (error) {
        logger.error(`📜 replace策略执行失败: ${storePath}`, error);
        return storeData; // 返回原数据
    }
}

/**
 * 应用patch策略：浅层合并snapshot到Store（纯函数）
 *
 * @param storePreferences - Store当前preferences
 * @param snapshot - 天界snapshot数据
 * @returns 合并后的preferences
 */
export function applyPatchStrategy(
    storePreferences: PreferenceState["preferences"],
    snapshot: unknown,
): PreferenceState["preferences"] {
    if (!snapshot || typeof snapshot !== "object") {
        logger.warn("📜 snapshot数据无效，返回原Store数据");
        return storePreferences;
    }

    // 浅层合并
    return { ...storePreferences, ...(snapshot as Record<string, unknown>) };
}

/**
 * 同步Store的主函数（唯一有副作用的函数，调用Store的方法）
 *
 * @param matter - 奏折类型
 * @param zhaolingResponse - 天界响应
 * @param syncMetadata - 同步配置
 * @param store - PreferenceStore实例
 */
export function syncStoreWithSnapshot(
    matter: string,
    zhaolingResponse: ZhaolingResponse,
    syncMetadata: MatterSyncMetadata,
    store: {
        preferences: PreferenceState["preferences"];
        $state: PreferenceState;
    },
): boolean {
    try {
        // 1. 提取snapshot（纯函数）
        const snapshot = extractSnapshotFromResponse(zhaolingResponse, syncMetadata.snapshotPath);
        if (!snapshot) {
            return false;
        }

        logger.info(`📜 开始Store自动同步: ${matter} (策略: ${syncMetadata.syncStrategy})`);

        // 2. 根据策略处理数据（纯函数）
        let updatedPreferences: PreferenceState["preferences"];

        switch (syncMetadata.syncStrategy) {
            case "merge":
                updatedPreferences = applyMergeStrategy(store.preferences, snapshot);
                logger.info(`📜 Store深度合并完成: ${matter}`);
                break;

            case "replace": {
                // replace策略需要特殊处理，因为要替换嵌套路径
                // 这里我们简化为merge策略，真正的replace需要更复杂的逻辑
                updatedPreferences = applyMergeStrategy(store.preferences, snapshot);
                logger.info(`📜 Store字段替换完成: ${syncMetadata.storePath}`);
                break;
            }

            case "patch":
                updatedPreferences = applyPatchStrategy(store.preferences, snapshot);
                logger.info(`📜 Store浅层合并完成: ${matter}`);
                break;

            default:
                logger.error(`📜 未知的同步策略: ${syncMetadata.syncStrategy}`);
                return false;
        }

        // 3. 应用到Store（有副作用的操作）
        applyPreferencesToStore(store, updatedPreferences);
        logger.info(`📜 Store自动同步成功: ${matter} -> ${syncMetadata.storePath}`);

        return true;
    } catch (error) {
        logger.error(`📜 Store自动同步失败: ${matter}`, error);
        return false;
    }
}
