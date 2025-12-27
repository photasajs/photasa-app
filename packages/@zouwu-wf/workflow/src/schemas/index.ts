/**
 * 📜 驺吾工作流Schema统一导出模块
 *
 * 🌌 仙术功能：提供所有JSON Schema的统一访问接口
 * 🔧 平台中立：使用静态导入，不依赖fs/path
 */

import workflowSchema from "../../schemas/workflow.schema.json";
import stepTypesSchema from "../../schemas/step-types.schema.json";
import templateSyntaxSchema from "../../schemas/template-syntax.schema.json";

/**
 * 🌌 获取工作流主Schema
 */
export function getWorkflowSchema(): any {
    return workflowSchema;
}

/**
 * 📜 获取步骤类型Schema
 */
export function getStepTypesSchema(): any {
    return stepTypesSchema;
}

/**
 * 🔧 获取模板语法Schema
 */
export function getTemplateSyntaxSchema(): any {
    return templateSyntaxSchema;
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
export function getSchemaMetadata(name: "workflow" | "stepTypes" | "templateSyntax") {
    let schema: any;
    switch (name) {
        case "workflow":
            schema = workflowSchema;
            break;
        case "stepTypes":
            schema = stepTypesSchema;
            break;
        case "templateSyntax":
            schema = templateSyntaxSchema;
            break;
    }

    return {
        id: schema.$id,
        title: schema.title,
        description: schema.description,
        version: schema.$id?.match(/v(\d+\.\d+\.\d+)/)?.[1] || "unknown",
    };
}

/**
 * 🔧 验证Schema版本兼容性
 */
export function validateSchemaCompatibility(userSchema: any, expectedVersion = "1.0.0"): boolean {
    if (!userSchema.$id) {
        console.warn("⚠️ Schema缺少$id字段");
        return false;
    }

    const versionMatch = userSchema.$id.match(/v(\d+\.\d+\.\d+)/);
    if (!versionMatch) {
        console.warn("⚠️ 无法从Schema $id中提取版本信息");
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
 * 🌌 清除Schema缓存 (空实现，因为现在是静态导入)
 */
export function clearSchemaCache(): void {
    // console.log('🔧 Schema是静态导入的，无需清除缓存');
}

// 🌌 导出Schema常量（用于类型定义）
export const WORKFLOW_SCHEMA_ID =
    "https://schemas.systembug.io/workflow/v1.0.0/workflow.schema.json";
export const STEP_TYPES_SCHEMA_ID =
    "https://schemas.systembug.io/workflow/v1.0.0/step-types.schema.json";
export const TEMPLATE_SYNTAX_SCHEMA_ID =
    "https://schemas.systembug.io/workflow/v1.0.0/template-syntax.schema.json";

/**
 * 📜 Schema文件映射
 */
export const SCHEMA_MAPPING = {
    [WORKFLOW_SCHEMA_ID]: "workflow",
    [STEP_TYPES_SCHEMA_ID]: "stepTypes",
    [TEMPLATE_SYNTAX_SCHEMA_ID]: "templateSyntax",
} as const;
