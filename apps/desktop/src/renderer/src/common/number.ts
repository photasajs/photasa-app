/**
 * 将字符串或数字转换为数字，如果转换失败，返回默认值
 * @param value 字符串或数字
 * @param defaultValue 默认值
 * @returns 数字
 */
export function safeNumber(value: number | string, defaultValue = 0): number {
    // 如果 value 是数字，则直接返回
    if (typeof value === "number") {
        return value; // 如果 value 是数字，则直接返回
    }
    // 如果 value 是字符串，则转换为数字
    if (typeof value === "string") {
        const num = parseInt(value, 10);
        return isNaN(num) ? defaultValue : num; // 如果转换失败，返回默认值
    }
    return defaultValue;
}

/**
 * 将字符串或数字转换为正整数，如果转换失败，返回默认值
 * @param value 字符串或数字
 * @param defaultValue 默认值
 * @returns 正整数
 */
export function safePositiveNumber(value: number | string, defaultValue = 1): number {
    // 如果 value 是字符串，则转换为正整数
    const num = safeNumber(value, defaultValue);

    return num <= 0 ? Math.abs(defaultValue <= 0 ? 1 : defaultValue) : num; // 如果转换失败，返回默认值
}
