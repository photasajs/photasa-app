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
import { loggers } from "@photasa/common";
import { mergeStoreData } from "../utils";
import { get, isEmpty, isObject, set } from "radash";

const logger = loggers.fangxuanling;

/**
 * 从Store中获取指定路径的数据（纯函数）
 *
 * ✅ RFC 0042 Store Automation修正 (Linus "好品味"设计):
 * - 参数名从storePath改为propertyPath，明确表示属性链而非路径
 *
 * @param store - Store实例
 * @param propertyPath - 属性链（如"queue"、"ui.theme"、"."表示根级别）
 * @returns 目标数据
 */
export function getStoreFieldData(
    store: Record<string, unknown>,
    propertyPath: string,
): Record<string, unknown> {
    const pathParts = propertyPath.split(".");

    // 如果只有一个部分（如"queue"），直接返回store对应字段
    if (pathParts.length === 1) {
        return (store[pathParts[0]] as Record<string, unknown>) || {};
    }

    // 否则使用get方法获取嵌套字段
    return get(store, propertyPath, {}) as Record<string, unknown>;
}

/**
 * 设置Store指定路径的数据（有副作用）
 *
 * ✅ RFC 0042 Store Automation修正 (Linus "好品味"设计):
 * - 参数名从snapshotPath改为propertyPath，明确表示属性链
 *
 * @param store - Store实例
 * @param propertyPath - 属性链（如"."、"queue"、"ui.theme"）
 *   - "." 表示在字段根级别深度合并（如preferences字段）
 *   - "queue" 表示设置字段内的queue属性
 *   - "ui.theme" 表示设置嵌套路径ui.theme
 * @param newData - 新数据
 *
 * 示例：
 * - setStoreFieldData(preferencesStore, ".", { ui: {...} })
 *   → 深度合并到preferences字段：preferencesStore.$patch({ preferences: { ui: {...} } })
 * - setStoreFieldData(scanningStore, "queue", [...])
 *   → 设置queue属性：scanningStore.$patch({ queue: [...] })
 */
export function setStoreFieldData(
    store: Record<string, unknown> & {
        $patch:
            | ((data: Record<string, unknown>) => void)
            | ((fn: (state: unknown) => void) => void);
    },
    propertyPath: string,
    newData: unknown,
): void {
    // ✅ 特殊处理："."表示在字段根级别深度合并
    // 例如：preferences字段接收整个preferences对象 { ui, display, scanning, ... }
    if (propertyPath === "." || isEmpty(propertyPath)) {
        if (!isObject(newData)) {
            logger.error(`❌ propertyPath为"."时，newData必须是对象`);
            return;
        }
        (store.$patch as (data: Record<string, unknown>) => void)(
            newData as Record<string, unknown>,
        );
        logger.debug(`📚 册库已深度合并整个对象到字段根级别`);
        return;
    }

    // ✅ 修复：使用函数式 $patch 来正确更新属性
    // 这样可以避免覆盖父对象的其他属性
    (store.$patch as (fn: (state: unknown) => void) => void)((state) => {
        const stateObj = state as Record<string, unknown>;

        // 检查是否是嵌套路径
        if (propertyPath.includes(".")) {
            // 嵌套路径：使用 radash set（它会正确处理嵌套路径）
            // 例如：set(state, "ui.theme", "dark") 只更新 theme，保留 language, layout 等其他属性
            set(stateObj, propertyPath, newData);
        } else {
            // 顶层路径：直接赋值（radash set 对顶层路径不修改原对象）
            // 例如：state["preferences"] = newData
            stateObj[propertyPath] = newData;
        }
    });
    logger.debug(`📚 册库嵌套字段已更新: ${propertyPath}`);
}

/**
 * 从天界响应中提取snapshot数据（纯函数）
 *
 * ✅ RFC 0042 Store Automation修正 (Linus "好品味"设计):
 * - 参数名从snapshotPath改为propertyPath，明确表示属性链
 *
 * @param zhaolingResponse - 天界响应
 * @param propertyPath - 属性链（如"queue"、"."表示根级别）
 * @returns 提取的snapshot数据，失败返回null
 */
export function extractSnapshotFromResponse(
    zhaolingResponse: ZhaolingResponse,
    propertyPath: string,
): unknown | null {
    try {
        const snapshot: unknown = zhaolingResponse.data;

        // 如果snapshot为空或不是对象，则返回null
        if (!isObject(snapshot)) {
            logger.warn(`⚠️ 提取的snapshot数据无效`);
            return null;
        }

        // 如果propertyPath为空或为.，则返回snapshot
        if (isEmpty(propertyPath) || propertyPath === ".") {
            return snapshot;
        }

        return get(snapshot, propertyPath);
    } catch (error) {
        logger.error(`❌ 提取snapshot失败: ${propertyPath}`, error);
        return null;
    }
}

/**
 * 同步Store的主函数（唯一有副作用的函数，调用Store的方法）
 *
 * ✅ RFC 0038: 支持任意Store，不再硬编码到PreferenceStore
 * ✅ RFC 0042 Store Automation修正 (Linus "好品味"设计):
 * - syncMetadata.snapshotPath → syncMetadata.propertyPath
 * - syncMetadata.storePath → syncMetadata.storeName
 * - 修复merge/patch策略：直接在完整Store上操作，而不是提取单个字段
 *
 * @param matter - 奏折类型
 * @param zhaolingResponse - 天界响应
 * @param syncMetadata - 同步配置（包含storeName决定使用哪个Store）
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
        const snapshot = extractSnapshotFromResponse(zhaolingResponse, syncMetadata.propertyPath);
        if (!snapshot) {
            logger.error(`❌ 提取snapshot失败: ${syncMetadata.propertyPath}`);
            return false;
        }

        logger.info(
            `📚 开始册库自动同步: ${matter} (策略: ${syncMetadata.syncStrategy}, 目标: ${syncMetadata.storeName})`,
        );

        // 2. 根据策略处理数据
        switch (syncMetadata.syncStrategy) {
            case "replace":
                // replace策略：直接替换指定路径的数据（可以是任何值：对象、数组、字符串、数字等）
                setStoreFieldData(store, syncMetadata.propertyPath, snapshot);
                logger.info(
                    `📚 册库字段替换完成: ${syncMetadata.storeName}.${syncMetadata.propertyPath}`,
                );
                break;

            case "merge":
                // merge策略：深度合并到Store指定路径
                // ✅ 关键修复：传入Store的当前数据（$state），而不是Store对象本身
                if (!isObject(snapshot)) {
                    logger.error(`❌ merge策略要求snapshot为对象`);
                    return false;
                }

                // 获取Store的当前数据（普通对象，不是响应式Store）
                const currentData = { ...store } as Record<string, unknown>;

                // 执行深度合并，返回要patch的数据对象
                const patchData = mergeStoreData(currentData, syncMetadata.propertyPath, snapshot);

                // 应用patch到Store
                if (isObject(patchData) && Object.keys(patchData).length > 0) {
                    store.$patch(patchData as Record<string, unknown>);
                    logger.info(`📚 册库深度合并完成: ${matter}`);
                } else {
                    logger.warn(`⚠️ 合并结果为空，跳过patch: ${matter}`);
                }
                break;

            default:
                logger.error(`❌ 未知的同步策略: ${syncMetadata.syncStrategy}`);
                return false;
        }

        logger.info(`📚 册库自动同步成功: ${matter} -> ${syncMetadata.storeName}`);
        return true;
    } catch (error) {
        logger.error(`❌ 册库自动同步失败: ${matter}`, error);
        return false;
    }
}
