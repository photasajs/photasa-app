/**
 * 📜 驺吾工作流Schema统一导出模块
 *
 * 🌌 仙术功能：提供所有JSON Schema的统一访问接口
 * 🔧 工作流操作：加载和导出Schema定义
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 🌌 Schema文件路径配置
 */
// 在编译后的代码中，schemas 会被复制到 build/schemas 目录
// 尝试多个可能的路径
function getSchemaDir(): string {
    // 编译后的代码在 build/schemas/index.js，schemas 文件在同一目录
    const sameDir = __dirname;
    if (fs.existsSync(path.join(sameDir, 'workflow.schema.json'))) {
        return sameDir;
    }
    // 如果在测试环境中，schemas 在 build/schemas 目录（与当前文件同级）
    const testPath = path.join(__dirname, 'schemas');
    if (fs.existsSync(testPath)) {
        return testPath;
    }
    // 否则使用开发环境的路径
    return path.join(__dirname, '../../schemas');
}

const SCHEMA_DIR = getSchemaDir();

const SCHEMA_FILES = {
    workflow: 'workflow.schema.json',
    stepTypes: 'step-types.schema.json',
    templateSyntax: 'template-syntax.schema.json',
} as const;

/**
 * 📜 懒加载Schema内容
 */
let cachedSchemas: Record<string, any> = {};

/**
 * 🔧 加载指定Schema文件
 */
function loadSchema(name: keyof typeof SCHEMA_FILES): any {
    if (cachedSchemas[name]) {
        return cachedSchemas[name];
    }

    try {
        const schemaPath = path.join(SCHEMA_DIR, SCHEMA_FILES[name]);
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
        const schema = JSON.parse(schemaContent);

        cachedSchemas[name] = schema;
        return schema;
    } catch (error) {
        console.error(`❌ 加载Schema失败: ${name}`, error);
        throw new Error(`Failed to load schema: ${name}`);
    }
}

/**
 * 🌌 获取工作流主Schema
 */
export function getWorkflowSchema(): any {
    return loadSchema('workflow');
}

/**
 * 📜 获取步骤类型Schema
 */
export function getStepTypesSchema(): any {
    return loadSchema('stepTypes');
}

/**
 * 🔧 获取模板语法Schema
 */
export function getTemplateSyntaxSchema(): any {
    return loadSchema('templateSyntax');
}

/**
 * 🌌 获取所有Schema
 */
export function getAllSchemas() {
    return {
        workflow: getWorkflowSchema(),
        stepTypes: getStepTypesSchema(),
        templateSyntax: getTemplateSyntaxSchema(),
    };
}

/**
 * 📜 获取Schema元数据
 */
export function getSchemaMetadata(schemaName: keyof typeof SCHEMA_FILES) {
    const schema = loadSchema(schemaName);
    return {
        id: schema.$id,
        title: schema.title,
        description: schema.description,
        version: schema.$id?.match(/v(\d+\.\d+\.\d+)/)?.[1] || 'unknown',
    };
}

/**
 * 🔧 验证Schema版本兼容性
 */
export function validateSchemaCompatibility(userSchema: any, expectedVersion = '1.0.0'): boolean {
    if (!userSchema.$id) {
        console.warn('⚠️ Schema缺少$id字段');
        return false;
    }

    const versionMatch = userSchema.$id.match(/v(\d+\.\d+\.\d+)/);
    if (!versionMatch) {
        console.warn('⚠️ 无法从Schema $id中提取版本信息');
        return false;
    }

    const schemaVersion = versionMatch[1];
    if (schemaVersion !== expectedVersion) {
        console.warn(`⚠️ Schema版本不兼容: 期望 ${expectedVersion}, 实际 ${schemaVersion}`);
        return false;
    }

    return true;
}

/**
 * 🌌 清除Schema缓存
 */
export function clearSchemaCache(): void {
    cachedSchemas = {};
    console.log('🔧 Schema缓存已清除');
}

// 🌌 导出Schema常量（用于类型定义）
export const WORKFLOW_SCHEMA_ID =
    'https://schemas.systembug.io/workflow/v1.0.0/workflow.schema.json';
export const STEP_TYPES_SCHEMA_ID =
    'https://schemas.systembug.io/workflow/v1.0.0/step-types.schema.json';
export const TEMPLATE_SYNTAX_SCHEMA_ID =
    'https://schemas.systembug.io/workflow/v1.0.0/template-syntax.schema.json';

/**
 * 📜 Schema文件映射
 */
export const SCHEMA_MAPPING = {
    [WORKFLOW_SCHEMA_ID]: 'workflow',
    [STEP_TYPES_SCHEMA_ID]: 'stepTypes',
    [TEMPLATE_SYNTAX_SCHEMA_ID]: 'templateSyntax',
} as const;
