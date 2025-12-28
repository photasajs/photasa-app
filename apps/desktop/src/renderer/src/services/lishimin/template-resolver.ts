/**
 * 模板变量解析器（纯函数）
 * 用于解析 YAML 配置中的模板变量，支持递归处理数组和对象
 *
 * @description
 * 纯函数设计，无副作用，易于测试
 * 支持模板语法：{{qizou.content.path}} → 实际值
 * 支持数组和对象中的模板变量递归解析
 *
 * @since 2025-01-23
 */

import type { Qizou } from "@renderer/interfaces/qizou.interface";
import { loggers } from "@photasa/common";

const logger = loggers.lishimin;

/**
 * 解析单个模板变量值
 *
 * @param value 模板字符串，如 "{{qizou.content.path}}"
 * @param qizou 启奏对象
 * @returns 解析后的值
 */
export function resolveTemplateValue(value: string, qizou: Qizou): unknown {
    if (typeof value !== "string" || !value.startsWith("{{") || !value.endsWith("}}")) {
        return value;
    }

    const path = value.slice(2, -2).trim(); // 去除 {{ 和 }}
    const parts = path.split("."); // ['qizou', 'content', 'path']

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = { qizou };
    for (const part of parts) {
        current = current[part];
        if (current === undefined) {
            logger.warn(`👑 李世民：无法解析模板变量 ${value}`);
            return value; // 返回原始值
        }
    }

    return current;
}

/**
 * 递归解析值（支持数组、对象和字符串中的模板变量）
 *
 * @param value 要解析的值（可能是字符串、数组或对象）
 * @param qizou 启奏对象
 * @returns 解析后的值
 */
export function resolveValueRecursive(value: unknown, qizou: Qizou): unknown {
    // 处理数组
    if (Array.isArray(value)) {
        return value.map((item) => resolveValueRecursive(item, qizou));
    }

    // 处理对象
    if (value !== null && typeof value === "object") {
        const resolved: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            resolved[k] = resolveValueRecursive(v, qizou);
        }
        return resolved;
    }

    // 处理字符串模板变量
    if (typeof value === "string") {
        return resolveTemplateValue(value, qizou);
    }

    // 其他类型直接返回
    return value;
}

/**
 * 解析圣旨内容（支持模板变量，递归处理数组和对象）
 *
 * @param content 原始内容
 * @param qizou 启奏对象
 * @returns 解析后的内容
 * @description
 * 支持模板语法：{{qizou.content.path}} → 实际值
 * 支持数组和对象中的模板变量递归解析
 */
export function resolveContent(
    content: Record<string, unknown>,
    qizou: Qizou,
): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(content)) {
        // 递归处理数组、对象和字符串
        resolved[key] = resolveValueRecursive(value, qizou);
    }

    return resolved;
}
