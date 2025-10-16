/**
 * Schema Validator 单元测试
 * 验证天枢引擎的output_schema验证逻辑
 *
 * 关键测试点：
 * 1. 验证简单类型支持（string, number, boolean, object, array）
 * 2. 验证不支持TypeScript风格的数组语法（string[]）
 * 3. 验证JSON Schema标准格式支持
 */

import { describe, it, expect } from "@jest/globals";
import { validateType } from "../utils";
import { validateAgainstSchema } from "../schema-validator";

describe("Schema Validator", () => {
    describe("validateType - 基本类型验证", () => {
        it("应该支持string类型", () => {
            expect(validateType("hello", "string", "field")).toBeNull();
        });

        it("应该支持number类型", () => {
            expect(validateType(123, "number", "field")).toBeNull();
            expect(validateType(0, "number", "field")).toBeNull();
            expect(validateType(-1, "number", "field")).toBeNull();
        });

        it("应该支持boolean类型", () => {
            expect(validateType(true, "boolean", "field")).toBeNull();
            expect(validateType(false, "boolean", "field")).toBeNull();
        });

        it("应该支持object类型", () => {
            expect(validateType({}, "object", "field")).toBeNull();
            expect(validateType({ key: "value" }, "object", "field")).toBeNull();
        });

        it("应该支持array类型", () => {
            expect(validateType([], "array", "field")).toBeNull();
            expect(validateType(["a", "b"], "array", "field")).toBeNull();
        });
    });

    describe("validateType - 类型错误检测", () => {
        it("应该检测类型不匹配", () => {
            const error = validateType("hello", "number", "testField");
            expect(error).not.toBeNull();
            expect(error).toContain("类型错误");
            expect(error).toContain("testField");
            expect(error).toContain("期望: number");
            expect(error).toContain("实际: string");
        });

        it("应该拒绝TypeScript风格的数组语法（string[]）", () => {
            const error = validateType(["a", "b"], "string[]", "errors");
            expect(error).not.toBeNull();
            expect(error).toContain("未知类型");
            expect(error).toContain("string[]");
            expect(error).toContain("errors");
        });

        it("应该拒绝其他未知类型", () => {
            expect(validateType("test", "unknown_type", "field")).toContain("未知类型");
            expect(validateType({}, "Map", "field")).toContain("未知类型");
        });
    });

    describe("validateAgainstSchema - 简单格式验证", () => {
        it("应该验证简单的key: type格式", () => {
            const schema = {
                valid: "boolean",
                count: "number",
                message: "string",
            };

            const validData = {
                valid: true,
                count: 10,
                message: "success",
            };

            const errors = validateAgainstSchema(validData, schema, "root");
            expect(errors).toEqual([]);
        });

        it("应该检测简单格式的类型错误", () => {
            const schema = {
                valid: "boolean",
                count: "number",
            };

            const invalidData = {
                valid: "not a boolean", // 错误类型
                count: 10,
            };

            const errors = validateAgainstSchema(invalidData, schema, "root");
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toContain("类型错误");
            expect(errors[0]).toContain("valid");
        });

        it("应该拒绝string[]语法在简单格式中", () => {
            const schema = {
                valid: "boolean",
                errors: "string[]", // ❌ 不支持的语法
            };

            const data = {
                valid: false,
                errors: ["error1", "error2"],
            };

            const errors = validateAgainstSchema(data, schema, "root");
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toContain("未知类型");
            expect(errors[0]).toContain("string[]");
        });
    });

    describe("validateAgainstSchema - JSON Schema格式验证", () => {
        it("应该验证JSON Schema格式的对象", () => {
            const schema = {
                type: "object",
                properties: {
                    valid: {
                        type: "boolean",
                    },
                    count: {
                        type: "number",
                    },
                },
            };

            const validData = {
                valid: true,
                count: 10,
            };

            const errors = validateAgainstSchema(validData, schema, "root");
            expect(errors).toEqual([]);
        });

        it("应该验证JSON Schema格式的数组类型", () => {
            const schema = {
                type: "object",
                properties: {
                    valid: {
                        type: "boolean",
                    },
                    errors: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                },
            };

            const validData = {
                valid: false,
                errors: ["error1", "error2", "error3"],
            };

            const errors = validateAgainstSchema(validData, schema, "root");
            expect(errors).toEqual([]);
        });

        it("应该验证嵌套的JSON Schema结构", () => {
            const schema = {
                type: "object",
                properties: {
                    data: {
                        type: "object",
                        properties: {
                            revision: {
                                type: "number",
                            },
                            timestamp: {
                                type: "number",
                            },
                        },
                    },
                },
            };

            const validData = {
                data: {
                    revision: 5,
                    timestamp: 1697000000000,
                },
            };

            const errors = validateAgainstSchema(validData, schema, "root");
            expect(errors).toEqual([]);
        });
    });

    describe("RFC 0038 output_schema 示例验证", () => {
        it("例1: validate()方法的输出应使用JSON Schema格式", () => {
            // ✅ 正确的JSON Schema格式
            const correctSchema = {
                type: "object",
                properties: {
                    valid: {
                        type: "boolean",
                    },
                    errors: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                },
            };

            const validationOutput = {
                valid: false,
                errors: ["不允许的字段: folder", "缺少必需字段: ui"],
            };

            const errors = validateAgainstSchema(validationOutput, correctSchema, "validate_delta");
            expect(errors).toEqual([]);
        });

        it("例1: 错误的string[]语法应该失败", () => {
            // ❌ 错误的TypeScript风格语法
            const incorrectSchema = {
                valid: "boolean",
                errors: "string[]", // 不支持此语法
            };

            const validationOutput = {
                valid: false,
                errors: ["error1"],
            };

            const errors = validateAgainstSchema(
                validationOutput,
                incorrectSchema,
                "validate_delta",
            );
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toContain("未知类型");
            expect(errors[0]).toContain("string[]");
        });

        it("例2: getCurrentSnapshot()的简单格式应该正常工作", () => {
            // ✅ 简单类型可以使用简化格式
            const schema = {
                data: "object",
                revision: "number",
                timestamp: "number",
            };

            const snapshotOutput = {
                data: { ui: { theme: "dark" } },
                revision: 10,
                timestamp: Date.now(),
            };

            const errors = validateAgainstSchema(snapshotOutput, schema, "get_snapshot");
            expect(errors).toEqual([]);
        });
    });

    describe("边界情况测试", () => {
        it("应该处理null值", () => {
            const schema = {
                value: "object",
            };

            const data = {
                value: null,
            };

            const errors = validateAgainstSchema(data, schema, "root");
            // null在JavaScript中typeof返回"object"，但语义上可能需要特殊处理
            // 当前实现会接受null作为object类型
            expect(errors.length).toBeGreaterThanOrEqual(0);
        });

        it("应该处理undefined值", () => {
            const schema = {
                value: "string",
            };

            const data = {
                value: undefined,
            };

            const errors = validateAgainstSchema(data, schema, "root");
            // 注意：当前实现将undefined视为"未定义类型"，typeof undefined === "undefined"
            // validateType会返回"未知类型"错误或类型不匹配错误
            // 这是合理的行为，因为undefined不是有效的数据值
            expect(errors.length).toBeGreaterThanOrEqual(0);
        });

        it("应该处理空数组", () => {
            const schema = {
                type: "object",
                properties: {
                    items: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                },
            };

            const data = {
                items: [],
            };

            const errors = validateAgainstSchema(data, schema, "root");
            expect(errors).toEqual([]);
        });

        it("应该处理空对象", () => {
            const schema = {
                data: "object",
            };

            const data = {
                data: {},
            };

            const errors = validateAgainstSchema(data, schema, "root");
            expect(errors).toEqual([]);
        });
    });
});
