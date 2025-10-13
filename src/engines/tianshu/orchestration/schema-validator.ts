/**
 * JSON Schema 验证器（纯函数模块）
 * 用于验证工作流步骤输出是否符合 output_schema 定义
 *
 * 所有函数都是纯函数：
 * - 无副作用（无I/O、无状态修改）
 * - 相同输入总是产生相同输出
 * - 可预测、可测试
 */
import { validateType } from "./utils";

/**
 * 验证结果类型
 */
export type ValidationResult = { valid: true } | { valid: false; errors: string[] };

/**
 * 验证步骤输出是否匹配 output_schema
 * 纯函数：只验证数据并返回结果，不产生副作用
 *
 * @param actualOutput - 实际输出数据
 * @param schema - JSON Schema定义
 * @param stepId - 步骤ID（用于错误消息）
 * @returns 验证结果对象
 */
export function validateStepOutput(
    actualOutput: unknown,
    schema: Record<string, unknown>,
    stepId: string,
): ValidationResult {
    const errors = validateAgainstSchema(actualOutput, schema, stepId);

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { valid: true };
}

/**
 * 根据JSON Schema验证数据
 * 纯函数：递归验证数据结构
 *
 * @param data - 要验证的数据
 * @param schema - JSON Schema定义
 * @param path - 当前路径（用于错误消息）
 * @returns 错误消息数组
 */
function validateAgainstSchema(
    data: unknown,
    schema: Record<string, unknown>,
    path = "root",
): string[] {
    const errors: string[] = [];

    if (!schema || typeof schema !== "object") {
        return errors;
    }

    // 处理JSON Schema标准格式: { type: "object", properties: {...} }
    if (schema.type) {
        return validateJsonSchemaType(data, schema, path);
    }

    // 类型守卫：确保data是对象
    if (typeof data !== "object" || data === null) {
        errors.push(`字段「${path}」必须是对象，实际类型: ${typeof data}`);
        return errors;
    }

    // 处理简化格式: { field: "type" | {...} }
    for (const [key, valueSchema] of Object.entries(schema)) {
        // 检查字段是否存在
        if (!(key in data) || (data as Record<string, unknown>)[key] === undefined) {
            // 检查是否为必需字段
            if (
                schema.required &&
                Array.isArray(schema.required) &&
                schema.required.includes(key)
            ) {
                errors.push(`字段「${path}.${key}」缺失`);
            }
            continue;
        }

        const actualValue = (data as Record<string, unknown>)[key];
        const fieldPath = `${path}.${key}`;

        // 字符串类型声明: { field: "string" }
        if (typeof valueSchema === "string") {
            const typeError = validateType(actualValue, valueSchema, fieldPath);
            if (typeError) {
                errors.push(typeError);
            }
        }
        // 嵌套schema
        else if (valueSchema && typeof valueSchema === "object" && !Array.isArray(valueSchema)) {
            const nestedErrors = validateAgainstSchema(
                actualValue,
                valueSchema as Record<string, unknown>,
                fieldPath,
            );
            errors.push(...nestedErrors);
        }
    }

    return errors;
}

/**
 * 验证JSON Schema标准格式
 * 纯函数：处理 { type: "...", properties: {...} } 格式
 *
 * @param data - 要验证的数据
 * @param schema - JSON Schema定义
 * @param path - 当前路径
 * @returns 错误消息数组
 */
function validateJsonSchemaType(
    data: unknown,
    schema: Record<string, unknown>,
    path: string,
): string[] {
    const errors: string[] = [];
    const schemaType = schema.type as string;

    // 验证基本类型
    const typeError = validateType(data, schemaType, path);
    if (typeError) {
        errors.push(typeError);
        return errors;
    }

    // 如果是对象类型，验证properties
    if (schemaType === "object" && schema.properties) {
        // 类型守卫
        if (typeof data !== "object" || data === null) {
            return errors; // 已在validateType中报告
        }

        const properties = schema.properties as Record<string, unknown>;
        const requiredFields = (schema.required as string[]) || [];

        for (const [key, valueSchema] of Object.entries(properties)) {
            const actualValue = (data as Record<string, unknown>)[key];
            const fieldPath = `${path}.${key}`;

            // 检查必需字段
            if (requiredFields.includes(key) && actualValue === undefined) {
                errors.push(`字段「${fieldPath}」缺失`);
                continue;
            }

            // 跳过undefined的可选字段
            if (actualValue === undefined) {
                continue;
            }

            // 递归验证
            if (typeof valueSchema === "object" && valueSchema !== null) {
                const nestedErrors = validateAgainstSchema(
                    actualValue,
                    valueSchema as Record<string, unknown>,
                    fieldPath,
                );
                errors.push(...nestedErrors);
            }
        }
    }

    // 如果是数组类型，验证items
    if (schemaType === "array" && schema.items) {
        // 类型守卫
        if (!Array.isArray(data)) {
            return errors; // 已在validateType中报告
        }

        const itemSchema = schema.items as Record<string, unknown>;
        data.forEach((item, index) => {
            const itemPath = `${path}[${index}]`;
            const itemErrors = validateAgainstSchema(item, itemSchema, itemPath);
            errors.push(...itemErrors);
        });
    }

    return errors;
}
