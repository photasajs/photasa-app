/**
 * 模板变量解析器单元测试
 * 测试纯函数的模板变量解析功能
 *
 * @since 2025-01-23
 */

import { describe, it, expect } from "vitest";
import { resolveTemplateValue, resolveValueRecursive, resolveContent } from "../template-resolver";
import type { Qizou } from "@renderer/interfaces/qizou.interface";

describe("模板变量解析器（纯函数）", () => {
    const createTestQizou = (content: Record<string, unknown>): Qizou => ({
        matter: "test",
        content,
        from: "测试服务",
        timestamp: Date.now(),
        metadata: { type: "report" },
    });

    describe("resolveTemplateValue", () => {
        it("应该解析简单的模板变量", () => {
            const qizou = createTestQizou({ path: "/test/path" });
            const result = resolveTemplateValue("{{qizou.content.path}}", qizou);
            expect(result).toBe("/test/path");
        });

        it("应该解析嵌套的模板变量", () => {
            const qizou = createTestQizou({ nested: { value: "nested-value" } });
            const result = resolveTemplateValue("{{qizou.content.nested.value}}", qizou);
            expect(result).toBe("nested-value");
        });

        it("应该处理无法解析的模板变量", () => {
            const qizou = createTestQizou({ path: "/test/path" });
            const result = resolveTemplateValue("{{qizou.content.nonexistent}}", qizou);
            expect(result).toBe("{{qizou.content.nonexistent}}");
        });

        it("应该直接返回非模板字符串", () => {
            const qizou = createTestQizou({ path: "/test/path" });
            const result = resolveTemplateValue("plain-string", qizou);
            expect(result).toBe("plain-string");
        });

        it("应该处理非字符串值", () => {
            const qizou = createTestQizou({ path: "/test/path" });
            // @ts-expect-error 测试非字符串输入
            const result = resolveTemplateValue(123, qizou);
            expect(result).toBe(123);
        });
    });

    describe("resolveValueRecursive", () => {
        it("应该递归解析数组中的模板变量", () => {
            const qizou = createTestQizou({ path: "/test/path" });
            const input = ["{{qizou.content.path}}", "plain-string"];
            const result = resolveValueRecursive(input, qizou);
            expect(result).toEqual(["/test/path", "plain-string"]);
        });

        it("应该递归解析对象中的模板变量", () => {
            const qizou = createTestQizou({ path: "/test/path", name: "test-name" });
            const input = {
                path: "{{qizou.content.path}}",
                name: "{{qizou.content.name}}",
                plain: "plain-value",
            };
            const result = resolveValueRecursive(input, qizou);
            expect(result).toEqual({
                path: "/test/path",
                name: "test-name",
                plain: "plain-value",
            });
        });

        it("应该处理嵌套数组和对象", () => {
            const qizou = createTestQizou({ path: "/test/path" });
            const input = {
                paths: ["{{qizou.content.path}}", "{{qizou.content.path}}"],
                nested: {
                    value: "{{qizou.content.path}}",
                },
            };
            const result = resolveValueRecursive(input, qizou);
            expect(result).toEqual({
                paths: ["/test/path", "/test/path"],
                nested: {
                    value: "/test/path",
                },
            });
        });

        it("应该直接返回非对象、非数组、非字符串的值", () => {
            const qizou = createTestQizou({ path: "/test/path" });
            expect(resolveValueRecursive(123, qizou)).toBe(123);
            expect(resolveValueRecursive(true, qizou)).toBe(true);
            expect(resolveValueRecursive(null, qizou)).toBe(null);
        });
    });

    describe("resolveContent", () => {
        it("应该解析包含数组的content", () => {
            const qizou = createTestQizou({ path: "/test/path" });
            const content = {
                paths: ["{{qizou.content.path}}"],
            };
            const result = resolveContent(content, qizou);
            expect(result).toEqual({
                paths: ["/test/path"],
            });
        });

        it("应该解析包含嵌套对象的content", () => {
            const qizou = createTestQizou({ path: "/test/path", name: "test-name" });
            const content = {
                nested: {
                    path: "{{qizou.content.path}}",
                    name: "{{qizou.content.name}}",
                },
            };
            const result = resolveContent(content, qizou);
            expect(result).toEqual({
                nested: {
                    path: "/test/path",
                    name: "test-name",
                },
            });
        });

        it("应该处理混合类型的content", () => {
            const qizou = createTestQizou({ path: "/test/path" });
            const content = {
                string: "{{qizou.content.path}}",
                array: ["{{qizou.content.path}}"],
                number: 123,
                boolean: true,
            };
            const result = resolveContent(content, qizou);
            expect(result).toEqual({
                string: "/test/path",
                array: ["/test/path"],
                number: 123,
                boolean: true,
            });
        });

        it("应该处理空的content", () => {
            const qizou = createTestQizou({});
            const content = {};
            const result = resolveContent(content, qizou);
            expect(result).toEqual({});
        });
    });
});
