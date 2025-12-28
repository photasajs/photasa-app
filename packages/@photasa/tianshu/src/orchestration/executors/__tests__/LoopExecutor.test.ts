/**
 * LoopExecutor 单元测试
 */

import { LoopExecutor } from "../LoopExecutor";
import { LoopStep } from "../../../types";

describe("LoopExecutor", () => {
    let executor: LoopExecutor;

    beforeEach(() => {
        executor = new LoopExecutor();
    });

    describe("prepareIterations", () => {
        test("应该处理数组源", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
                iterator: { source: ["a", "b", "c"], variable: "item" },
            } as any;
            const iterations = executor.prepareIterations(step, null);
            expect(iterations).toEqual(["a", "b", "c"]);
        });

        test("应该处理数字源（生成索引数组）", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
                iterator: { source: 3, variable: "item" },
            } as any;
            const iterations = executor.prepareIterations(step, null);
            expect(iterations).toEqual([0, 1, 2]);
        });

        test("应该处理对象源（转为键值对）", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
                iterator: { source: { a: 1, b: 2 }, variable: "item" },
            } as any;
            const iterations = executor.prepareIterations(step, null);
            expect(iterations).toEqual([
                { key: "a", value: 1 },
                { key: "b", value: 2 },
            ]);
        });

        test("应该支持旧格式 - count为数字", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
                loop: {
                    count: 5,
                    variable: "i",
                    steps: [],
                },
            } as any;
            const iterations = executor.prepareIterations(step, null);
            expect(iterations).toEqual([0, 1, 2, 3, 4]);
        });

        test("应该支持旧格式 - count为数组", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
                loop: {
                    count: ["x", "y", "z"],
                    variable: "item",
                    steps: [],
                },
            } as any;
            const iterations = executor.prepareIterations(step, null);
            expect(iterations).toEqual(["x", "y", "z"]);
        });

        test("应该使用resolvedData覆盖配置", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
                iterator: { source: [], variable: "item" },
            } as any;
            const resolvedData = ["resolved1", "resolved2"];
            const iterations = executor.prepareIterations(step, resolvedData);
            expect(iterations).toEqual(["resolved1", "resolved2"]);
        });

        test("无效配置应该抛出错误", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
                // missing iterator and loop
            } as any;
            expect(() => executor.prepareIterations(step, null)).toThrow(
                "Invalid loop configuration",
            );
        });
    });

    describe("createLoopContext", () => {
        test("应该创建完整的循环上下文", () => {
            const ctx1 = executor.createLoopContext("first", 0, 3);
            expect(ctx1).toEqual({
                item: "first",
                index: 0,
                total: 3,
                isFirst: true,
                isLast: false,
            });

            const ctx2 = executor.createLoopContext("middle", 1, 3);
            expect(ctx2).toEqual({
                item: "middle",
                index: 1,
                total: 3,
                isFirst: false,
                isLast: false,
            });

            const ctx3 = executor.createLoopContext("last", 2, 3);
            expect(ctx3).toEqual({
                item: "last",
                index: 2,
                total: 3,
                isFirst: false,
                isLast: true,
            });
        });
    });

    describe("getVariableName", () => {
        test("应该返回iterator中的变量名", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
                iterator: { source: [], variable: "myItem" },
            } as any;
            expect(executor.getVariableName(step)).toBe("myItem");
        });

        test("应该返回旧格式的变量名", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
                loop: {
                    variable: "oldItem",
                    count: 5,
                    steps: [],
                },
            } as any;
            expect(executor.getVariableName(step)).toBe("oldItem");
        });

        test("应该返回默认变量名", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
            } as any;
            expect(executor.getVariableName(step)).toBe("item");
        });
    });

    describe("getIndexName", () => {
        test("应该返回iterator中的索引名", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
                iterator: { source: [], variable: "item", index: "i" },
            } as any;
            expect(executor.getIndexName(step)).toBe("i");
        });

        test("应该返回默认索引名", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
                iterator: { source: [], variable: "item" },
            } as any;
            expect(executor.getIndexName(step)).toBe("index");
        });
    });

    describe("getSource", () => {
        test("应该返回iterator source", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
                iterator: { source: "source", variable: "item" },
            } as any;
            expect(executor.getSource(step)).toBe("source");
        });

        test("应该返回loop count (fallback)", () => {
            const step: LoopStep = {
                type: "loop",
                steps: [],
                loop: { count: "count", steps: [], variable: "i" },
            } as any;
            expect(executor.getSource(step)).toBe("count");
        });
    });
});
