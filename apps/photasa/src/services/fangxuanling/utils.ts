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
import { isEmpty, set, get, isObject, isString } from "radash";
import { loggers } from "@photasa/common";

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

    const targetRecord = target as Record<string, unknown>;
    const sourceRecord = source as Record<string, unknown>;
    const result: Record<string, unknown> = { ...targetRecord };

    // 遍历source的所有key
    for (const key in sourceRecord) {
        if (Object.prototype.hasOwnProperty.call(sourceRecord, key)) {
            const sourceValue = sourceRecord[key];
            const targetValue = targetRecord[key];

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
 * 深度合并Store数据到指定路径（纯函数）
 *
 * ✅ RFC 0042修正：
 * - 重命名：deepMergePreferences → deepMergeToStore（通用化）
 * - 修复逻辑：对具体路径也进行深度合并，而不是简单set替换
 * - 关键修复：返回要patch的数据对象，而不是整个Store副本
 *
 * @param currentData 当前Store的数据（普通对象，不是Store实例）
 * @param propertyPath 属性链："."表示根级别，其他表示具体路径（如"ui.theme"）
 * @param source 源数据（来自天界）
 * @returns 要patch到Store的数据对象
 */
export function deepMergeToStore(
    currentData: unknown,
    propertyPath: string,
    source: unknown,
): unknown {
    // Source为空，返回空对象（无需patch）
    if (isEmpty(source)) {
        logger.debug("📚 source为空，无需合并");
        return {};
    }

    // propertyPath为"."或空时，深度合并整个source到根级别
    if (propertyPath === "." || isEmpty(propertyPath)) {
        logger.debug("📚 深度合并整个source到Store根级别");
        if (!isObject(currentData)) {
            // currentData无效，直接返回source
            return source;
        }
        // 深度合并currentData和source，返回合并结果
        return deepMergeObjects(currentData, source);
    }

    // ✅ 关键修复：对于具体路径，也要进行深度合并，而不是简单set
    // 1. 获取目标路径的当前值
    const currentValue = isObject(currentData) ? get(currentData, propertyPath) : undefined;

    // 2. 构建要patch的数据对象
    const patchData: Record<string, unknown> = {};

    // 3. 如果当前值是对象且source也是对象，进行深度合并
    if (isObject(currentValue) && isObject(source)) {
        logger.debug(`📚 深度合并到路径: ${propertyPath}`);
        const mergedValue = deepMergeObjects(currentValue, source);
        set(patchData, propertyPath, mergedValue);
    } else {
        // 4. 否则直接替换（如数组或基本类型）
        logger.debug(`📚 直接替换路径: ${propertyPath}`);
        set(patchData, propertyPath, source);
    }

    return patchData;
}

/**
 * @deprecated 使用 deepMergeToStore 替代
 * 保留用于向后兼容
 */
export function deepMergePreferences(target: unknown, storePath: string, source: unknown): unknown {
    return deepMergeToStore(target, storePath, source);
}

/**
 * 深度合并Store数据（带错误处理）
 *
 * ✅ RFC 0042修正：重命名mergePreferencesFromTianjie → mergeStoreData
 * 纯函数版本，返回要patch的数据对象，不直接操作Store
 *
 * @param currentData 当前Store的数据（普通对象，通过$state获取）
 * @param propertyPath 属性链
 * @param snapshot 天界snapshot数据
 * @returns 要patch到Store的数据对象，如果合并失败返回空对象
 */
export function mergeStoreData(
    currentData: unknown,
    propertyPath: string,
    snapshot: unknown,
): unknown {
    try {
        // 数据验证
        if (!isString(propertyPath)) {
            logger.warn("⚠️ propertyPath无效，返回空对象");
            return {};
        }

        // 执行深度合并，返回要patch的数据
        const patchData = deepMergeToStore(currentData, propertyPath, snapshot);

        logger.info(`📚 合并Store数据: ${propertyPath}`, snapshot);
        return patchData;
    } catch (error) {
        logger.error("❌ 深度合并Store数据失败", error);
        // 合并失败时返回空对象（不patch）
        return {};
    }
}

/**
 * @deprecated 使用 mergeStoreData 替代
 * 保留用于向后兼容
 */
export function mergePreferencesFromTianjie(
    localPreferences: unknown,
    storePath: string,
    snapshot: unknown,
): unknown {
    return mergeStoreData(localPreferences, storePath, snapshot);
}
