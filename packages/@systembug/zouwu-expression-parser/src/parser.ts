/**
 * 📜 模板表达式解析器
 *
 * 🌌 仙术功能：解析 {{...}} 模板语法，提取变量引用和表达式
 */

import { TemplateVariableReference, ExpressionParseResult, VariableType } from './types';

/**
 * 🌌 模板表达式正则模式
 */
const TEMPLATE_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * 📜 简单变量路径模式
 */
const SIMPLE_VARIABLE_PATTERN =
    /^(inputs|variables|steps|loopContext|branchContext)\.[a-zA-Z_][a-zA-Z0-9_.\[\]]*$/;

/**
 * 🔧 带默认值的变量模式
 */
const VARIABLE_WITH_DEFAULT_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_.\[\]]*?)\s*\|\|\s*(.+)$/;

/**
 * 🌌 步骤输出模式
 */
const STEP_OUTPUT_PATTERN = /^steps\.([a-zA-Z_][a-zA-Z0-9_]*)\.output(?:\.(.+))?$/;

/**
 * 📜 循环变量模式
 */
const LOOP_VARIABLE_PATTERN = /^(currentFile|fileIndex|loopContext\.[a-zA-Z_][a-zA-Z0-9_]*)$/;

/**
 * 🔧 解析单个模板表达式
 */
export function parseTemplateExpression(
    template: string,
    expression: string
): TemplateVariableReference | null {
    const trimmed = expression.trim();

    // 尝试匹配简单变量路径
    const simpleMatch = trimmed.match(SIMPLE_VARIABLE_PATTERN);
    if (simpleMatch) {
        const fullPath = simpleMatch[0];
        const [type, ...pathParts] = fullPath.split('.');
        const path = pathParts.join('.');

        return {
            type: type as VariableType,
            path,
            expression: trimmed,
            hasDefault: false,
            rawTemplate: template,
        };
    }

    // 尝试匹配带默认值的变量
    const defaultMatch = trimmed.match(VARIABLE_WITH_DEFAULT_PATTERN);
    if (defaultMatch) {
        const variablePath = defaultMatch[1].trim();
        const defaultValue = defaultMatch[2].trim();

        // 检查是否是有效的变量路径
        const varMatch = variablePath.match(SIMPLE_VARIABLE_PATTERN);
        if (varMatch) {
            const fullPath = varMatch[0];
            const [type, ...pathParts] = fullPath.split('.');
            const path = pathParts.join('.');

            return {
                type: type as VariableType,
                path,
                expression: trimmed,
                hasDefault: true,
                defaultValue: parseDefaultValue(defaultValue),
                rawTemplate: template,
            };
        }
    }

    // 尝试匹配步骤输出
    const stepMatch = trimmed.match(STEP_OUTPUT_PATTERN);
    if (stepMatch) {
        const stepId = stepMatch[1];
        const fieldPath = stepMatch[2] || '';

        return {
            type: 'steps',
            path: `${stepId}.output${fieldPath ? '.' + fieldPath : ''}`,
            expression: trimmed,
            hasDefault: false,
            rawTemplate: template,
        };
    }

    // 尝试匹配循环变量
    const loopMatch = trimmed.match(LOOP_VARIABLE_PATTERN);
    if (loopMatch) {
        const varName = loopMatch[1];

        if (varName.startsWith('loopContext.')) {
            const path = varName.replace('loopContext.', '');
            return {
                type: 'loopContext',
                path,
                expression: trimmed,
                hasDefault: false,
                rawTemplate: template,
            };
        } else {
            return {
                type: 'loopContext',
                path: varName,
                expression: trimmed,
                hasDefault: false,
                rawTemplate: template,
            };
        }
    }

    // 如果是复杂表达式，返回基本信息
    return {
        type: 'inputs', // 默认类型，实际使用时需要进一步分析
        path: '',
        expression: trimmed,
        hasDefault: false,
        rawTemplate: template,
    };
}

/**
 * 🌌 解析默认值
 */
function parseDefaultValue(value: string): any {
    // 尝试解析为 JSON
    try {
        return JSON.parse(value);
    } catch {
        // 如果不是有效的 JSON，返回字符串（去除引号）
        const trimmed = value.trim();
        if (
            (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ) {
            return trimmed.slice(1, -1);
        }
        return trimmed;
    }
}

/**
 * 📜 从字符串中提取所有模板表达式
 */
export function extractTemplateExpressions(text: string): ExpressionParseResult {
    const variables: TemplateVariableReference[] = [];
    const expressions: string[] = [];
    let hasTemplate = false;

    const matches = text.matchAll(TEMPLATE_PATTERN);

    for (const match of matches) {
        hasTemplate = true;
        const fullMatch = match[0]; // 包含 {{}}
        const expression = match[1].trim(); // 表达式内容

        expressions.push(expression);

        const parsed = parseTemplateExpression(fullMatch, expression);
        if (parsed) {
            variables.push(parsed);
        }
    }

    return {
        hasTemplate,
        variables,
        original: text,
        expressions,
    };
}

/**
 * 🔧 递归提取对象中的所有模板表达式
 */
export function extractTemplateExpressionsFromObject(
    obj: any,
    path = 'root'
): ExpressionParseResult[] {
    const results: ExpressionParseResult[] = [];

    if (typeof obj === 'string') {
        const result = extractTemplateExpressions(obj);
        if (result.hasTemplate) {
            results.push(result);
        }
    } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
            results.push(...extractTemplateExpressionsFromObject(item, `${path}[${index}]`));
        });
    } else if (obj && typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
            results.push(...extractTemplateExpressionsFromObject(value, `${path}.${key}`));
        }
    }

    return results;
}

/**
 * 🌌 检查字符串是否包含模板表达式
 */
export function hasTemplateExpression(text: string): boolean {
    // 使用新的正则表达式实例，避免全局状态问题
    return /\{\{([^}]+)\}\}/.test(text);
}

/**
 * 📜 获取所有变量引用（去重）
 */
export function getAllVariableReferences(
    results: ExpressionParseResult[]
): TemplateVariableReference[] {
    const variableMap = new Map<string, TemplateVariableReference>();

    for (const result of results) {
        for (const variable of result.variables) {
            const key = `${variable.type}.${variable.path}`;
            if (!variableMap.has(key)) {
                variableMap.set(key, variable);
            }
        }
    }

    return Array.from(variableMap.values());
}
