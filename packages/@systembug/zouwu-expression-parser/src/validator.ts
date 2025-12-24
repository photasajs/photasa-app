/**
 * 📜 表达式验证器
 *
 * 🌌 仙术功能：验证模板表达式中引用的变量是否存在
 */

import {
    ExpressionValidationError,
    ExpressionValidationResult,
    TemplateVariableReference,
} from './types';
import { extractTemplateExpressions, extractTemplateExpressionsFromObject } from './parser';

/**
 * 🌌 验证变量引用是否有效
 */
export function validateVariableReferences(
    variables: TemplateVariableReference[],
    availableVariables: Set<string>,
    path = 'root'
): ExpressionValidationResult {
    const errors: ExpressionValidationError[] = [];

    for (const variable of variables) {
        const variablePath = variable.path ? `${variable.type}.${variable.path}` : variable.type;

        // 检查基础路径是否存在
        let found = false;
        for (const availableVar of availableVariables) {
            if (availableVar.startsWith(`${variable.type}.`)) {
                // 检查完整路径或部分路径匹配
                if (
                    availableVar === variablePath ||
                    availableVar.startsWith(variablePath + '.') ||
                    variablePath.startsWith(availableVar + '.')
                ) {
                    found = true;
                    break;
                }
            } else if (availableVar === variable.type) {
                // 如果变量类型本身在可用变量中
                found = true;
                break;
            }
        }

        if (!found && variable.path) {
            errors.push({
                path,
                message: `引用了未定义的变量: ${variablePath}`,
                value: variable.expression,
            });
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * 🔧 验证对象中的模板表达式
 */
export function validateTemplateExpressionsInObject(
    obj: any,
    availableVariables: Set<string>,
    path = 'root'
): ExpressionValidationResult {
    const errors: ExpressionValidationError[] = [];

    // 递归验证，保持路径信息
    function validateRecursive(currentObj: any, currentPath: string): void {
        if (typeof currentObj === 'string') {
            const validation = validateTemplateExpression(
                currentObj,
                availableVariables,
                currentPath
            );
            if (!validation.valid) {
                errors.push(...validation.errors);
            }
        } else if (Array.isArray(currentObj)) {
            currentObj.forEach((item, index) => {
                validateRecursive(item, `${currentPath}[${index}]`);
            });
        } else if (currentObj && typeof currentObj === 'object') {
            for (const [key, value] of Object.entries(currentObj)) {
                validateRecursive(value, `${currentPath}.${key}`);
            }
        }
    }

    validateRecursive(obj, path);

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * 🌌 验证单个字符串中的模板表达式
 */
export function validateTemplateExpression(
    text: string,
    availableVariables: Set<string>,
    path = 'root'
): ExpressionValidationResult {
    const result = extractTemplateExpressions(text);

    if (!result.hasTemplate) {
        return {
            valid: true,
            errors: [],
        };
    }

    return validateVariableReferences(result.variables, availableVariables, path);
}
