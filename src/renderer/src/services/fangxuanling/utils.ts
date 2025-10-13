import { isEmpty, set } from "radash";
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
import { isString } from "radash";

const logger = loggers.fangxuanling;

/**
 * 深度合并偏好设置数据
 * 纯函数实现，不修改原始对象
 *
 * @param target 目标偏好对象（本地设置）
 * @param source 源偏好对象（天界数据）
 * @returns 合并后的新偏好对象
 */
export function deepMergePreferences(target: any, storePath: string, source: any): any {
    // Source can be primitive or complex
    if (isEmpty(source)) {
        return target;
    }

    if (!target || typeof target !== "object") {
        return source;
    }

    // 创建目标对象的深拷贝，避免修改原始数据
    const result = JSON.parse(JSON.stringify(target));

    set(result, storePath, source);

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
export function mergePreferencesFromTianjie(
    localPreferences: any,
    storePath: string,
    snapshot: any,
): any {
    try {
        // 数据验证
        if (!isString(storePath)) {
            logger.warn("📜 storePath或snapshot无效，返回本地设置");
            return localPreferences;
        }

        // 执行深度合并
        const mergedPreferences = deepMergePreferences(localPreferences, storePath, snapshot);

        logger.info(`📜 合并设置: ${storePath}`, snapshot);
        return mergedPreferences;
    } catch (error) {
        logger.error("📜 智能合并天界偏好数据失败", error);
        // 合并失败时返回本地设置
        return localPreferences;
    }
}
