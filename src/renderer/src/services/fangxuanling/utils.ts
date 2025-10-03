/**
 * 房玄龄宰相工具函数 - 纯函数实现
 * 负责偏好设置合并逻辑，遵循纯函数设计原则
 *
 * 核心设计：
 * - 纯函数：无副作用，输入相同则输出相同
 * - 不可变：不修改原始数据，返回新对象
 * - 类型安全：完整的TypeScript类型定义
 * - 可测试：逻辑独立，易于单元测试
 */

import { loggers } from "@common/logger";

const logger = loggers.fangxuanling;

/**
 * 深度合并偏好设置数据
 * 纯函数实现，不修改原始对象
 *
 * @param target 目标偏好对象（本地设置）
 * @param source 源偏好对象（天界数据）
 * @returns 合并后的新偏好对象
 */
export function deepMergePreferences(target: any, source: any): any {
    if (!source || typeof source !== "object") {
        return target;
    }

    if (!target || typeof target !== "object") {
        return source;
    }

    // 创建目标对象的深拷贝，避免修改原始数据
    const result = JSON.parse(JSON.stringify(target));

    // 递归合并对象属性
    for (const [key, value] of Object.entries(source)) {
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            // 嵌套对象递归合并
            if (!result[key] || typeof result[key] !== "object") {
                result[key] = {};
            }
            result[key] = deepMergePreferences(result[key], value);
        } else {
            // 基础类型和数组直接覆盖
            result[key] = value;
        }
    }

    return result;
}

/**
 * 智能合并天界偏好数据
 * 纯函数版本，返回合并后的数据，不直接操作Store
 *
 * @param localPreferences 本地偏好设置
 * @param tianjieData 天界偏好数据
 * @returns 合并后的偏好设置，如果合并失败返回原始本地设置
 */
export function mergePreferencesFromTianjie(localPreferences: any, tianjieData: any): any {
    try {
        // 数据验证
        if (!tianjieData || typeof tianjieData !== "object") {
            logger.warn("📜 天界偏好数据为空，保持本地默认设置");
            return localPreferences;
        }

        if (!localPreferences || typeof localPreferences !== "object") {
            logger.warn("📜 本地偏好数据无效，使用天界数据");
            return tianjieData;
        }

        // 执行深度合并
        const mergedPreferences = deepMergePreferences(localPreferences, tianjieData);

        // 记录合并详情
        if (tianjieData.ui?.theme) {
            logger.info(`📜 合并主题设置: ${tianjieData.ui.theme}`);
        }
        if (tianjieData.ui?.language) {
            logger.info(`📜 合并语言设置: ${tianjieData.ui.language}`);
        }
        if (tianjieData.display?.thumbnailSize) {
            logger.info(`📜 合并缩略图大小: ${tianjieData.display.thumbnailSize}`);
        }

        logger.info("📜 天界偏好数据智能合并完成");
        return mergedPreferences;
    } catch (error) {
        logger.error("📜 智能合并天界偏好数据失败", error);
        // 合并失败时返回本地设置
        return localPreferences;
    }
}

/**
 * 应用偏好设置到Pinia Store
 * 使用$patch方法确保响应式更新
 *
 * @param store Pinia store实例
 * @param mergedPreferences 合并后的偏好设置
 */
export function applyPreferencesToStore(store: any, mergedPreferences: any): void {
    try {
        // 使用$patch进行响应式更新
        store.$patch((state: any) => {
            state.preferences = mergedPreferences;
        });

        logger.info("📜 偏好设置已应用到Store");
    } catch (error) {
        logger.error("📜 应用偏好设置到Store失败", error);
        throw error;
    }
}
