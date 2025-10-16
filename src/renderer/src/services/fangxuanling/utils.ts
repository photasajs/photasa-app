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
import { isEmpty, set, isObject, isString } from "radash";
import { loggers } from "@common/logger";

const logger = loggers.fangxuanling;

/**
 * 深度合并两个对象（纯函数）
 * 使用radash的isObject工具，遵循Linus"好品味"原则
 *
 * @param target 目标对象
 * @param source 源对象
 * @returns 深度合并后的新对象
 */
function deepMergeObjects(target: unknown, source: unknown): unknown {
    // 如果source不是对象，直接返回source
    if (!isObject(source)) {
        return source;
    }

    // 如果target不是对象，返回source的深拷贝
    if (!isObject(target)) {
        return JSON.parse(JSON.stringify(source));
    }

    // 创建结果对象，从target开始
    const result: Record<string, unknown> = { ...target };

    // 遍历source的所有key
    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const sourceValue = source[key];
            const targetValue = target[key];

            // 如果source和target的值都是对象，递归合并
            if (isObject(sourceValue) && isObject(targetValue)) {
                result[key] = deepMergeObjects(targetValue, sourceValue);
            } else {
                // 否则直接使用source的值
                result[key] = sourceValue;
            }
        }
    }

    return result;
}

/**
 * 深度合并偏好设置数据
 * 纯函数实现，不修改原始对象
 *
 * @param target 目标偏好对象（本地设置）
 * @param storePath 合并路径："."表示从根合并整个对象，其他路径使用set方法
 * @param source 源偏好对象（天界数据）
 * @returns 合并后的新偏好对象
 */
export function deepMergePreferences(target: unknown, storePath: string, source: unknown): unknown {
    // Source为空，返回target
    if (isEmpty(source)) {
        logger.debug("📚 source为空，返回target");
        return target;
    }

    // Target无效，返回source
    if (!target || !isObject(target)) {
        logger.debug("📚 target无效，返回source");
        return source;
    }

    // 创建目标对象的深拷贝，避免修改原始数据
    const result = JSON.parse(JSON.stringify(target));

    // storePath为"."时，深度合并整个source到result
    if (storePath === ".") {
        logger.debug("📚 深度合并整个source到result");
        const merged = deepMergeObjects(result, source);
        return merged;
    }

    // 否则使用radash的set方法设置指定路径
    logger.debug(`📚 设置路径: ${storePath}`);
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
            logger.warn("⚠️ storePath或snapshot无效，返回本地设置");
            return localPreferences;
        }

        // 执行深度合并
        const mergedPreferences = deepMergePreferences(localPreferences, storePath, snapshot);

        logger.info(`📚 合并设置: ${storePath}`, snapshot);
        return mergedPreferences;
    } catch (error) {
        logger.error("❌ 智能合并天界偏好数据失败", error);
        // 合并失败时返回本地设置
        return localPreferences;
    }
}
