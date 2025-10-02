/**
 * 📜 天枢工作流Schema核心包主入口
 *
 * 🌌 仙术功能：提供Schema定义、基础验证器和类型定义
 * 🔧 工作流操作：核心Schema功能，不包含CLI和代码生成
 */

// 🌌 导出核心Schema定义
export * from "./schemas";

// 🔧 导出类型定义
export * from "./types";

// 🌌 导出验证器
export * from "./validators";

/**
 * 🌌 核心包信息
 */
export const CORE_INFO = {
    name: "@systembug/workflow-schema",
    description: "Systembug工作流Schema定义和运行时验证器 - 核心包",
    version: "1.0.0",
    features: ["JSON Schema定义", "运行时验证器", "TypeScript类型定义", "Schema加载器"],
    relatedPackages: ["@systembug/workflow-cli"],
} as const;

/**
 * 📜 Schema版本信息
 */
export const SCHEMA_VERSION = "1.0.0";

/**
 * 🔧 基础配置
 */
export const DEFAULT_CONFIG = {
    schemaVersion: SCHEMA_VERSION,
    supportedStepTypes: ["condition", "action", "builtin", "loop", "parallel", "workflow"],
    supportedServices: ["taiyi", "wenchang", "qianliyan", "maliang"],
    supportedOperators: [
        "eq",
        "ne",
        "gt",
        "gte",
        "lt",
        "lte",
        "in",
        "nin",
        "exists",
        "not_exists",
        "matches",
        "and",
        "or",
    ],
    builtinActions: ["return", "setVariable", "log", "delay", "transform", "error"],
} as const;

/**
 * 🌌 验证配置兼容性
 */
export function validateConfig(config: any): boolean {
    if (!config.schemaVersion) {
        console.warn("⚠️ 配置中缺少schemaVersion字段");
        return false;
    }

    if (config.schemaVersion !== SCHEMA_VERSION) {
        console.warn(`⚠️ Schema版本不匹配: 期望 ${SCHEMA_VERSION}, 实际 ${config.schemaVersion}`);
        return false;
    }

    return true;
}
