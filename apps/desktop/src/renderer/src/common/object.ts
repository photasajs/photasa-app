import { isNumber, isObject } from "radash";
import { isArray } from "./array";
import { isString } from "./string";
import { isBoolean } from "./boolean";

export { isObject };

/**
 * 判断是否为空
 * @param value 值
 * @returns 是否为空
 */
export function notEmpty<T>(
    value: T | null | undefined | string | number | boolean | object,
): value is T {
    if (value === null || value === undefined) {
        return false;
    }
    if (isString(value)) {
        return value !== null && value !== undefined && value !== "" && value.length > 0;
    }
    if (isNumber(value)) {
        return value !== null && value !== undefined && value !== 0;
    }
    // 布尔值 不为空
    if (isBoolean(value)) {
        return true;
    }
    if (isObject(value)) {
        return value !== null && value !== undefined && Object.keys(value).length > 0;
    }
    if (isArray(value)) {
        return (value as unknown[]).length > 0;
    }
    return false;
}

/**
 * 判断是否为空
 * @param value 值
 * @returns 是否为空
 */
export function empty(value: unknown): boolean {
    return !notEmpty(value);
}
