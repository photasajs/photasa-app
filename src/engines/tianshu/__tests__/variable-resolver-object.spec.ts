/**
 * VariableResolver 对象处理测试
 * 验证对象类型的变量不会被错误地转换为字符串
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { VariableResolver } from "../orchestration/VariableResolver";
import { ExecutionContext } from "../types/workflows";

describe("VariableResolver 对象处理", () => {
    let resolver: VariableResolver;
    let context: ExecutionContext;

    beforeEach(() => {
        resolver = new VariableResolver({
            globalVariables: {},
            variablePrefix: "{{",
            strictMode: false,
        });

        context = {
            workflowId: "test",
            executionId: "test-exec",
            commandId: "test-cmd",
            startTime: Date.now(),
            status: "running",
            currentStepId: "test",
            input: {
                testInput: { foo: "bar" },
            },
            variables: {
                testVar: { baz: "qux" },
            },
            stepResults: new Map([
                [
                    "step1",
                    {
                        stepId: "step1",
                        status: "completed",
                        startTime: Date.now(),
                        endTime: Date.now(),
                        duration: 100,
                        retryCount: 0,
                        skipped: false,
                        success: true,
                        output: {
                            revision: 57,
                            ui: {
                                theme: "dark",
                                language: "en-US",
                            },
                            display: {
                                thumbnailSize: 200,
                            },
                        },
                    },
                ],
            ]),
            metrics: {
                stepCount: 1,
                successStepCount: 0,
                failedStepCount: 0,
                skippedStepCount: 0,
                totalDuration: 0,
            },
        };
    });

    it("应该保持对象类型不变，不转换为字符串", () => {
        const template = "{{ steps.step1.result }}";
        const result = resolver.resolveString(template, context);

        // 验证结果是对象，不是字符串
        expect(typeof result).toBe("object");
        expect(result).not.toBe("[object Object]");
        expect(result.revision).toBe(57);
        expect(result.ui.theme).toBe("dark");
        expect(result.ui.language).toBe("en-US");
        expect(result.display.thumbnailSize).toBe(200);
    });

    it("应该在混合文本中将对象序列化为JSON", () => {
        const template = "The result is: {{ steps.step1.result }} and more text";
        const result = resolver.resolveString(template, context);

        // 在混合文本中，对象应该被JSON序列化
        expect(typeof result).toBe("string");
        expect(result).toContain('"revision":57');
        expect(result).toContain('"theme":"dark"');
        expect(result).toContain('"language":"en-US"');
    });

    it("应该正确处理嵌套对象路径", () => {
        const template = "{{ steps.step1.result.ui }}";
        const result = resolver.resolveString(template, context);

        // 验证结果是UI对象
        expect(typeof result).toBe("object");
        expect(result.theme).toBe("dark");
        expect(result.language).toBe("en-US");
    });

    it("应该在resolveObject中正确处理包含模板的对象", () => {
        const obj = {
            success: true,
            data: "{{ steps.step1.result }}",
            message: "操作完成",
        };

        const result = resolver.resolveObject(obj, context);

        // data字段应该是对象，不是字符串
        expect(typeof result.data).toBe("object");
        expect(result.data.revision).toBe(57);
        expect(result.data.ui.theme).toBe("dark");
    });

    it("应该处理数组中的对象模板", () => {
        const arr = ["{{ steps.step1.result }}", "{{ variables.testVar }}"];
        const result = resolver.resolveObject(arr, context);

        // 数组元素应该是对象
        expect(Array.isArray(result)).toBe(true);
        expect(typeof result[0]).toBe("object");
        expect(result[0].revision).toBe(57);
        expect(typeof result[1]).toBe("object");
        expect(result[1].baz).toBe("qux");
    });

    it("应该处理复杂的嵌套结构", () => {
        const complex = {
            outer: {
                inner: {
                    value: "{{ steps.step1.result }}",
                    text: "Some text with {{ steps.step1.result.revision }} revision",
                },
            },
        };

        const result = resolver.resolveObject(complex, context);

        // value应该是对象
        expect(typeof result.outer.inner.value).toBe("object");
        expect(result.outer.inner.value.revision).toBe(57);

        // text应该是字符串，包含解析后的值
        expect(typeof result.outer.inner.text).toBe("string");
        expect(result.outer.inner.text).toBe("Some text with 57 revision");
    });
});
