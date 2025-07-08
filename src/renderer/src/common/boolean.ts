/**
 * 判断是否为布尔值
 * @param value 值
 * @returns 是否为布尔值
 */
export function isBoolean(value: unknown): value is boolean {
    return typeof value === "boolean";
}
