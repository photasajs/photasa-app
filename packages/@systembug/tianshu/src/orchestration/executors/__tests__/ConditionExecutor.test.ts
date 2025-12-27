/**
 * ConditionExecutor 单元测试
 */

import { ConditionExecutor } from "../ConditionExecutor";
import type { ConditionExpression as Condition } from "../../../types";

describe("ConditionExecutor", () => {
    let executor: ConditionExecutor;

    beforeEach(() => {
        executor = new ConditionExecutor();
    });

    describe("比较操作符", () => {
        test("eq - 相等", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "eq", value: "hello" },
                    "hello",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "eq", value: "hello" },
                    "world",
                ),
            ).toBe(false);
            expect(
                executor.evaluateCondition({ field: "test", operator: "eq", value: 42 }, 42),
            ).toBe(true);
        });

        test("ne - 不相等", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "ne", value: "hello" },
                    "world",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "ne", value: "hello" },
                    "hello",
                ),
            ).toBe(false);
        });

        test("gt - 大于", () => {
            expect(
                executor.evaluateCondition({ field: "test", operator: "gt", value: 5 }, 10),
            ).toBe(true);
            expect(executor.evaluateCondition({ field: "test", operator: "gt", value: 5 }, 3)).toBe(
                false,
            );
            expect(executor.evaluateCondition({ field: "test", operator: "gt", value: 5 }, 5)).toBe(
                false,
            );
        });

        test("gte - 大于等于", () => {
            expect(
                executor.evaluateCondition({ field: "test", operator: "gte", value: 5 }, 10),
            ).toBe(true);
            expect(
                executor.evaluateCondition({ field: "test", operator: "gte", value: 5 }, 5),
            ).toBe(true);
            expect(
                executor.evaluateCondition({ field: "test", operator: "gte", value: 5 }, 3),
            ).toBe(false);
        });

        test("lt - 小于", () => {
            expect(executor.evaluateCondition({ field: "test", operator: "lt", value: 5 }, 3)).toBe(
                true,
            );
            expect(
                executor.evaluateCondition({ field: "test", operator: "lt", value: 5 }, 10),
            ).toBe(false);
            expect(executor.evaluateCondition({ field: "test", operator: "lt", value: 5 }, 5)).toBe(
                false,
            );
        });

        test("lte - 小于等于", () => {
            expect(
                executor.evaluateCondition({ field: "test", operator: "lte", value: 5 }, 3),
            ).toBe(true);
            expect(
                executor.evaluateCondition({ field: "test", operator: "lte", value: 5 }, 5),
            ).toBe(true);
            expect(
                executor.evaluateCondition({ field: "test", operator: "lte", value: 5 }, 10),
            ).toBe(false);
        });
    });

    describe("集合操作符", () => {
        test("in - 包含于", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "in", value: ["a", "b", "c"] },
                    "b",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "in", value: ["a", "b", "c"] },
                    "d",
                ),
            ).toBe(false);
            expect(
                executor.evaluateCondition({ field: "test", operator: "in", value: [1, 2, 3] }, 2),
            ).toBe(true);
        });

        test("nin/notIn - 不包含于", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "nin", value: ["a", "b", "c"] },
                    "d",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "notIn", value: ["a", "b", "c"] },
                    "b",
                ),
            ).toBe(false);
        });
    });

    describe("存在性操作符", () => {
        test("exists - 存在", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "exists", value: null },
                    "value",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition({ field: "test", operator: "exists", value: null }, 0),
            ).toBe(true);
            expect(
                executor.evaluateCondition({ field: "test", operator: "exists", value: null }, ""),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "exists", value: null },
                    undefined,
                ),
            ).toBe(false);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "exists", value: null },
                    null,
                ),
            ).toBe(false);
        });

        test("notExists - 不存在", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "notExists", value: null },
                    undefined,
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "notExists", value: null },
                    null,
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "notExists", value: null },
                    "value",
                ),
            ).toBe(false);
        });
    });

    describe("字符串操作符", () => {
        test("startsWith - 以...开始", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "startsWith", value: "hello" },
                    "hello world",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "startsWith", value: "world" },
                    "hello world",
                ),
            ).toBe(false);
        });

        test("endsWith - 以...结束", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "endsWith", value: "world" },
                    "hello world",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "endsWith", value: "hello" },
                    "hello world",
                ),
            ).toBe(false);
        });

        test("contains - 包含", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "contains", value: "lo wo" },
                    "hello world",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "contains", value: "xyz" },
                    "hello world",
                ),
            ).toBe(false);
        });

        test("matches - 正则匹配", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "matches", value: "^[a-z]+$" },
                    "hello",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "matches", value: "^[a-z]+$" },
                    "Hello",
                ),
            ).toBe(false);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "matches", value: "\\d{3}" },
                    "abc123def",
                ),
            ).toBe(true);
        });
    });

    describe("空值检查操作符", () => {
        test("isEmpty - 为空", () => {
            expect(
                executor.evaluateCondition({ field: "test", operator: "isEmpty", value: null }, ""),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "isEmpty", value: null },
                    "   ",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition({ field: "test", operator: "isEmpty", value: null }, []),
            ).toBe(true);
            expect(
                executor.evaluateCondition({ field: "test", operator: "isEmpty", value: null }, {}),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "isEmpty", value: null },
                    null,
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "isEmpty", value: null },
                    undefined,
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "isEmpty", value: null },
                    "hello",
                ),
            ).toBe(false);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "isEmpty", value: null },
                    [1],
                ),
            ).toBe(false);
        });

        test("isNotEmpty - 不为空", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "isNotEmpty", value: null },
                    "hello",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "isNotEmpty", value: null },
                    [1],
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "isNotEmpty", value: null },
                    { a: 1 },
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "isNotEmpty", value: null },
                    "",
                ),
            ).toBe(false);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "isNotEmpty", value: null },
                    [],
                ),
            ).toBe(false);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "isNotEmpty", value: null },
                    {},
                ),
            ).toBe(false);
        });
    });

    describe("字符串长度验证操作符", () => {
        test("string_maxlen - 最大长度", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "string_maxlen", value: 10 },
                    "hello",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "string_maxlen", value: 10 },
                    "1234567890",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "string_maxlen", value: 10 },
                    "12345678901",
                ),
            ).toBe(false);
        });

        test("string_minlen - 最小长度", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "string_minlen", value: 5 },
                    "hello",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "string_minlen", value: 5 },
                    "hello world",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "string_minlen", value: 5 },
                    "hi",
                ),
            ).toBe(false);
        });

        test("optional_string_maxlen - 可选最大长度", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "optional_string_maxlen", value: 10 },
                    undefined,
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "optional_string_maxlen", value: 10 },
                    null,
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "optional_string_maxlen", value: 10 },
                    "hello",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "optional_string_maxlen", value: 10 },
                    "12345678901",
                ),
            ).toBe(false);
        });

        test("optional_string_minlen - 可选最小长度", () => {
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "optional_string_minlen", value: 5 },
                    undefined,
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "optional_string_minlen", value: 5 },
                    null,
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "optional_string_minlen", value: 5 },
                    "hello",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "optional_string_minlen", value: 5 },
                    "hi",
                ),
            ).toBe(false);
        });
    });

    describe("逻辑操作符", () => {
        test("and - 逻辑与", () => {
            const conditions = [
                { field: "test", operator: "gt", value: 5 },
                { field: "test", operator: "lt", value: 15 },
            ];
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "and", value: conditions },
                    10,
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "and", value: conditions },
                    3,
                ),
            ).toBe(false);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "and", value: conditions },
                    20,
                ),
            ).toBe(false);
        });

        test("or - 逻辑或", () => {
            const conditions = [
                { field: "test", operator: "eq", value: "hello" },
                { field: "test", operator: "eq", value: "world" },
            ];
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "or", value: conditions },
                    "hello",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "or", value: conditions },
                    "world",
                ),
            ).toBe(true);
            expect(
                executor.evaluateCondition(
                    { field: "test", operator: "or", value: conditions },
                    "foo",
                ),
            ).toBe(false);
        });
    });

    describe("getConditionSummary", () => {
        test("应该生成条件摘要", () => {
            const condition = { field: "inputs.name", operator: "eq", value: "John" };
            expect(executor.getConditionSummary(condition as Condition)).toBe(
                'inputs.name eq "John"',
            );
        });

        it("should format condition with array value", () => {
            const condition = {
                field: "inputs.tags",
                operator: "in",
                value: ["tag1", "tag2"],
            };
            expect(executor.getConditionSummary(condition as Condition)).toBe(
                'inputs.tags in ["tag1","tag2"]',
            );
        });
    });
});
