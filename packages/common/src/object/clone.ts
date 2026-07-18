/**
 * 深拷贝工具函数
 * Linus风格纯函数设计：不抛异常，性能优先，简洁实现
 *
 * 设计原则：
 * - 纯函数：相同输入，相同输出，无副作用
 * - 不抛异常：永远返回有效结果
 * - 性能优先：避免不必要的类型检查
 * - 简洁实现：代码清晰，易于理解和维护
 */

/**
 * 深拷贝任意类型的数据
 *
 * 支持的类型：
 * - 基本类型：string, number, boolean, null, undefined
 * - 对象：普通对象 (plain objects)
 * - 数组：任意嵌套数组
 * - Date：日期对象
 *
 * 不支持的类型（会被忽略或转换）：
 * - Function：会被忽略
 * - Symbol：会被忽略
 * - Map/Set：会被转换为空对象
 * - 循环引用：会导致无限递归（使用时需注意）
 *
 * @param value 要深拷贝的值
 * @returns 深拷贝后的新值
 *
 * @example
 * ```typescript
 * const original = { a: 1, b: { c: 2 } };
 * const cloned = deepClone(original);
 * cloned.b.c = 3; // 不会影响 original
 * ```
 */
export function deepClone<T>(value: T): T {
    // 基本类型直接返回
    if (value === null || value === undefined) {
        return value;
    }

    // 基本类型（string, number, boolean）
    if (typeof value !== "object") {
        return value;
    }

    // Date 对象
    if (value instanceof Date) {
        return new Date(value.getTime()) as T;
    }

    // 数组
    if (Array.isArray(value)) {
        return value.map((item) => deepClone(item)) as T;
    }

    // 普通对象
    const clonedObject: Record<string, unknown> = {};
    for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
            clonedObject[key] = deepClone((value as Record<string, unknown>)[key]);
        }
    }

    return clonedObject as T;
}
