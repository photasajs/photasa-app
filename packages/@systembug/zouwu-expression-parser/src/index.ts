/**
 * 📜 驺吾表达式解析器主入口
 *
 * 🌌 仙术功能：提供模板表达式解析和验证功能
 */

// 导出类型
export * from './types';

// 导出解析器
export * from './parser';

// 导出验证器
export * from './validator';

/**
 * 🌌 包信息
 */
export const PACKAGE_INFO = {
    name: '@systembug/zouwu-expression-parser',
    description: '驺吾工作流表达式解析器 - 解析和验证 {{...}} 模板语法',
    version: '1.0.0',
} as const;
