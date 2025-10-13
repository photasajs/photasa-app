/**
 * Store同步纯函数工具集
 *
 * 遵循Linus "好品味"原则：
 * 1. 所有函数都是纯函数，无副作用
 * 2. 输入相同则输出相同
 * 3. 易于测试和维护
 * 4. 函数组合优于类继承
 * 5. 配置驱动，支持任意Store类型
 */

import type { MatterSyncMetadata } from "./index";
import type { ZhaolingResponse } from "@renderer/interfaces/yuan-tian-gang.interface";
import { loggers } from "@common/logger";
import { mergePreferencesFromTianjie } from "../utils";
import { get, isEmpty } from "radash";

const logger = loggers.fangxuanling;

/**
 * 从Store中获取指定路径的数据（纯函数）
 *
 * @param store - Store实例
 * @param storePath - 数据路径（如"preferences"、"preferences.ui"）
 * @returns 目标数据
 */
export function getStoreFieldData(
    store: Record<string, unknown>,
    storePath: string,
): Record<string, unknown> {
    const pathParts = storePath.split(".");

    // 如果只有一个部分（如"preferences"），直接返回store对应字段
    if (pathParts.length === 1) {
        return (store[pathParts[0]] as Record<string, unknown>) || {};
    }

    // 否则使用get方法获取嵌套字段
    return get(store, storePath, {}) as Record<string, unknown>;
}

/**
 * 设置Store指定路径的数据（有副作用）
 *
 * @param store - Store实例
 * @param storePath - 数据路径（如"preferences"、"preferences.ui"）
 * @param newData - 新数据
 */
export function setStoreFieldData(
    store: Record<string, unknown> & { $patch: (data: Record<string, unknown>) => void },
    storePath: string,
    newData: Record<string, unknown>,
): void {
    const pathParts = storePath.split(".");

    // 如果只有一个部分（如"preferences"），使用$patch直接更新
    if (pathParts.length === 1) {
        store.$patch({
            [pathParts[0]]: newData,
        });
        logger.debug(`📜 Store字段已更新: ${storePath}`);
        return;
    }

    // 对于嵌套路径，需要构建完整的更新对象
    const updateObj: Record<string, unknown> = {};
    let current: Record<string, unknown> = updateObj;

    for (let i = 0; i < pathParts.length - 1; i++) {
        current[pathParts[i]] = {};
        current = current[pathParts[i]] as Record<string, unknown>;
    }
    current[pathParts[pathParts.length - 1]] = newData;

    store.$patch(updateObj);
    logger.debug(`📜 Store嵌套字段已更新: ${storePath}`);
}

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
        const snapshot: unknown = zhaolingResponse.data;
        // 如果snapshot为空或不是对象，则返回null
        if (!snapshot || typeof snapshot !== "object") {
            logger.warn(`📜 提取的snapshot数据无效`);
            return null;
        }

        // 如果snapshotPath为空或为.，则返回snapshot
        if (isEmpty(snapshotPath) || snapshotPath === ".") {
            return snapshot;
        }

        return get(snapshot, snapshotPath);
    } catch (error) {
        logger.error(`📜 提取snapshot失败: ${snapshotPath}`, error);
        return null;
    }
}

/**
 * 应用merge策略：深度合并snapshot到Store（纯函数）
 *
 * @param storeData - Store当前数据
 * @param snapshot - 天界snapshot数据
 * @returns 合并后的数据
 */
export function applyMergeStrategy(
    storeData: Record<string, unknown>,
    snapshot: unknown,
): Record<string, unknown> {
    if (!snapshot || typeof snapshot !== "object") {
        logger.warn("📜 snapshot数据无效，返回原Store数据");
        return storeData;
    }

    const mergedData = mergePreferencesFromTianjie(storeData, snapshot);
    return mergedData;
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
 * @param storeData - Store当前数据
 * @param snapshot - 天界snapshot数据
 * @returns 合并后的数据
 */
export function applyPatchStrategy(
    storeData: Record<string, unknown>,
    snapshot: unknown,
): Record<string, unknown> {
    if (!snapshot || typeof snapshot !== "object") {
        logger.warn("📜 snapshot数据无效，返回原Store数据");
        return storeData;
    }

    // 浅层合并
    return { ...storeData, ...(snapshot as Record<string, unknown>) };
}

/**
 * 同步Store的主函数（唯一有副作用的函数，调用Store的方法）
 *
 * ✅ RFC 0038: 支持任意Store，不再硬编码到PreferenceStore
 *
 * @param matter - 奏折类型
 * @param zhaolingResponse - 天界响应
 * @param syncMetadata - 同步配置（包含storePath决定使用哪个Store）
 * @param store - 任意Pinia Store实例
 */
export function syncStoreWithSnapshot(
    matter: string,
    zhaolingResponse: ZhaolingResponse,
    syncMetadata: MatterSyncMetadata,
    store: Record<string, unknown> & { $patch: (data: Record<string, unknown>) => void },
): boolean {
    try {
        // 1. 提取snapshot（纯函数）
        const snapshot = extractSnapshotFromResponse(zhaolingResponse, syncMetadata.snapshotPath);
        if (!snapshot) {
            return false;
        }

        logger.info(
            `📜 开始Store自动同步: ${matter} (策略: ${syncMetadata.syncStrategy}, 目标: ${syncMetadata.storePath})`,
        );

        // 2. 获取Store当前数据
        const currentStoreData = getStoreFieldData(store, syncMetadata.storePath);

        // 3. 根据策略处理数据（纯函数）
        let updatedData: Record<string, unknown>;

        switch (syncMetadata.syncStrategy) {
            case "merge":
                updatedData = applyMergeStrategy(currentStoreData, snapshot);
                logger.info(`📜 Store深度合并完成: ${matter}`);
                break;

            case "replace":
                // replace策略：完全替换
                if (typeof snapshot !== "object" || snapshot === null) {
                    logger.error(`📜 replace策略要求snapshot为对象`);
                    return false;
                }
                updatedData = snapshot as Record<string, unknown>;
                logger.info(`📜 Store字段替换完成: ${syncMetadata.storePath}`);
                break;

            case "patch":
                updatedData = applyPatchStrategy(currentStoreData, snapshot);
                logger.info(`📜 Store浅层合并完成: ${matter}`);
                break;

            default:
                logger.error(`📜 未知的同步策略: ${syncMetadata.syncStrategy}`);
                return false;
        }

        // 4. 应用到Store（有副作用的操作）
        setStoreFieldData(store, syncMetadata.storePath, updatedData);
        logger.info(`📜 Store自动同步成功: ${matter} -> ${syncMetadata.storePath}`);

        return true;
    } catch (error) {
        logger.error(`📜 Store自动同步失败: ${matter}`, error);
        return false;
    }
}
