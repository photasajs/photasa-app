/**
 * 📜 驺吾工作流CLI工具包主入口
 *
 * 🌌 仙术功能：对外提供命令行工具和代码生成器API
 * 🔧 工作流操作：统一导出CLI相关功能
 */

// 导出代码生成器
export * from './generators/schema-to-types';
export * from './generators/schema-to-validators';

// 导出CLI工具（用于程序化调用）
// program 在 cli/index.ts 中未导出，这里只导出生成器

/**
 * 🌌 CLI工具包信息
 */
export const CLI_INFO = {
    name: '@systembug/workflow-cli',
    description: 'Systembug工作流命令行工具',
    version: '1.0.0',
    dependencies: ['@systembug/workflow-schema'],
    commands: [
        'generate-types',
        'generate-validators',
        'generate-all',
        'validate',
        'init',
        'version',
    ],
} as const;
