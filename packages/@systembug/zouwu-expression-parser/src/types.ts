/**
 * 📜 表达式解析器类型定义
 *
 * 🌌 仙术功能：定义模板表达式解析相关的类型
 */

/**
 * 🌌 变量引用类型
 */
export type VariableType = 'inputs' | 'variables' | 'steps' | 'loopContext' | 'branchContext';

/**
 * 📜 模板变量引用解析结果
 */
export interface TemplateVariableReference {
    /** 变量类型 */
    type: VariableType;
    /** 变量路径 */
    path: string;
    /** 完整表达式 */
    expression: string;
    /** 是否包含默认值 */
    hasDefault: boolean;
    /** 默认值（如果存在） */
    defaultValue?: any;
    /** 原始模板字符串（包含 {{}}） */
    rawTemplate?: string;
}

/**
 * 🔧 表达式解析结果
 */
export interface ExpressionParseResult {
    /** 是否包含模板表达式 */
    hasTemplate: boolean;
    /** 提取的所有变量引用 */
    variables: TemplateVariableReference[];
    /** 原始字符串 */
    original: string;
    /** 解析后的表达式部分（去除 {{}}） */
    expressions: string[];
}

/**
 * 🌌 表达式验证错误
 */
export interface ExpressionValidationError {
    /** 错误路径 */
    path: string;
    /** 错误消息 */
    message: string;
    /** 错误值 */
    value: string;
    /** 表达式位置（在原始字符串中的位置） */
    position?: {
        start: number;
        end: number;
    };
}

/**
 * 📜 表达式验证结果
 */
export interface ExpressionValidationResult {
    /** 验证是否通过 */
    valid: boolean;
    /** 错误列表 */
    errors: ExpressionValidationError[];
}
