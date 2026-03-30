export { isString } from "radash";

/**
 * 将字符串或数字转换为字符串，如果转换失败，返回默认值
 * 或者调用 toString 方法，如果 toString 方法返回空字符串，则返回默认值
 * @param value 字符串或数字
 * @param defaultValue 默认值
 * @returns 字符串
 */
export function safeString(value: unknown, defaultValue = ""): string {
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number") {
        return String(value);
    }
    return value?.toString() || defaultValue;
}
