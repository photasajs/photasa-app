/**
 * BuiltinAdapter 数组操作测试
 * RFC 0045: Builtin数组操作增强
 *
 * 遵循数据扁平化策略：方法直接返回值，不包装
 */

import { BuiltinAdapter } from "../BuiltinAdapter";

describe("BuiltinAdapter - 数组操作 (RFC 0045 - 数据扁平化)", () => {
    let adapter: BuiltinAdapter;

    beforeEach(async () => {
        adapter = new BuiltinAdapter();
        await adapter.initialize();
    });

    afterEach(async () => {
        await adapter.shutdown();
    });

    describe("arrayAppend - 数组追加", () => {
        it("应该追加单个元素到非空数组", async () => {
            const result = await adapter.arrayAppend({
                array: [1, 2, 3],
                item: 4,
            });

            // 直接返回数组，无包装
            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual([1, 2, 3, 4]);
        });

        it("应该追加元素到空数组", async () => {
            const result = await adapter.arrayAppend({
                array: [],
                item: "first",
            });

            expect(result).toEqual(["first"]);
        });

        it("应该追加对象到数组", async () => {
            const result = await adapter.arrayAppend({
                array: [{ id: 1 }],
                item: { id: 2 },
            });

            expect(result).toEqual([{ id: 1 }, { id: 2 }]);
        });

        it("应该验证原数组不变（纯函数）", async () => {
            const original = [1, 2, 3];
            const result = await adapter.arrayAppend({
                array: original,
                item: 4,
            });

            expect(result).toEqual([1, 2, 3, 4]);
            expect(original).toEqual([1, 2, 3]); // 原数组未改变
        });

        it("应在array为null时抛出错误", async () => {
            await expect(
                adapter.arrayAppend({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    array: null as any,
                    item: 1,
                }),
            ).rejects.toThrow("array参数不能为null或undefined");
        });

        it("应在array为undefined时抛出错误", async () => {
            await expect(
                adapter.arrayAppend({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    array: undefined as any,
                    item: 1,
                }),
            ).rejects.toThrow("array参数不能为null或undefined");
        });

        it("应在array不是数组时抛出错误", async () => {
            await expect(
                adapter.arrayAppend({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    array: "not an array" as any,
                    item: 1,
                }),
            ).rejects.toThrow("array参数必须是数组类型");
        });

        it("应追加null值到数组", async () => {
            const result = await adapter.arrayAppend({
                array: [1, 2],
                item: null,
            });

            expect(result).toEqual([1, 2, null]);
        });
    });

    describe("arrayCount - 数组计数", () => {
        it("应该返回非空数组长度", async () => {
            const result = await adapter.arrayCount({
                array: [1, 2, 3, 4, 5],
            });

            // 直接返回数字，无包装
            expect(typeof result).toBe("number");
            expect(result).toBe(5);
        });

        it("应该返回空数组长度为0", async () => {
            const result = await adapter.arrayCount({
                array: [],
            });

            expect(result).toBe(0);
        });

        it("应在array为null时抛出错误", async () => {
            await expect(
                adapter.arrayCount({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    array: null as any,
                }),
            ).rejects.toThrow("array参数不能为null或undefined");
        });

        it("应在array为undefined时抛出错误", async () => {
            await expect(
                adapter.arrayCount({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    array: undefined as any,
                }),
            ).rejects.toThrow("array参数不能为null或undefined");
        });

        it("应在array不是数组时抛出错误", async () => {
            await expect(
                adapter.arrayCount({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    array: "not an array" as any,
                }),
            ).rejects.toThrow("array参数必须是数组类型");
        });
    });

    describe("arrayFilter - 数组过滤", () => {
        const testArray = [
            { id: 1, name: "Alice", age: 25 },
            { id: 2, name: "Bob", age: 30 },
            { id: 3, name: "Charlie", age: 25 },
        ];

        it("应该使用eq操作符过滤数组", async () => {
            const result = await adapter.arrayFilter({
                array: testArray,
                condition: {
                    field: "age",
                    operator: "eq",
                    value: 25,
                },
            });

            // 直接返回数组，无包装
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 1, name: "Alice", age: 25 });
            expect(result[1]).toEqual({ id: 3, name: "Charlie", age: 25 });
        });

        it("应该使用ne操作符过滤数组", async () => {
            const result = await adapter.arrayFilter({
                array: testArray,
                condition: {
                    field: "age",
                    operator: "ne",
                    value: 25,
                },
            });

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ id: 2, name: "Bob", age: 30 });
        });

        it("应该使用gt操作符过滤数组", async () => {
            const result = await adapter.arrayFilter({
                array: testArray,
                condition: {
                    field: "age",
                    operator: "gt",
                    value: 25,
                },
            });

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ id: 2, name: "Bob", age: 30 });
        });

        it("应该使用lt操作符过滤数组", async () => {
            const result = await adapter.arrayFilter({
                array: testArray,
                condition: {
                    field: "age",
                    operator: "lt",
                    value: 30,
                },
            });

            expect(result).toHaveLength(2);
        });

        it("应该使用gte操作符过滤数组", async () => {
            const result = await adapter.arrayFilter({
                array: testArray,
                condition: {
                    field: "age",
                    operator: "gte",
                    value: 25,
                },
            });

            expect(result).toHaveLength(3);
        });

        it("应该使用lte操作符过滤数组", async () => {
            const result = await adapter.arrayFilter({
                array: testArray,
                condition: {
                    field: "age",
                    operator: "lte",
                    value: 25,
                },
            });

            expect(result).toHaveLength(2);
        });

        it("应该支持嵌套字段访问", async () => {
            const nestedArray = [
                { user: { profile: { name: "Alice" } } },
                { user: { profile: { name: "Bob" } } },
            ];

            const result = await adapter.arrayFilter({
                array: nestedArray,
                condition: {
                    field: "user.profile.name",
                    operator: "eq",
                    value: "Alice",
                },
            });

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ user: { profile: { name: "Alice" } } });
        });

        it("应该验证原数组不变（纯函数）", async () => {
            const original = [...testArray];
            const result = await adapter.arrayFilter({
                array: testArray,
                condition: {
                    field: "age",
                    operator: "eq",
                    value: 25,
                },
            });

            expect(result).toHaveLength(2);
            expect(testArray).toEqual(original); // 原数组未改变
        });

        it("应该返回空数组当没有匹配项", async () => {
            const result = await adapter.arrayFilter({
                array: testArray,
                condition: {
                    field: "age",
                    operator: "gt",
                    value: 100,
                },
            });

            expect(result).toEqual([]);
        });

        it("应在array为null时抛出错误", async () => {
            await expect(
                adapter.arrayFilter({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    array: null as any,
                    condition: {
                        field: "age",
                        operator: "eq",
                        value: 25,
                    },
                }),
            ).rejects.toThrow("array参数不能为null或undefined");
        });

        it("应在array不是数组时抛出错误", async () => {
            await expect(
                adapter.arrayFilter({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    array: "not an array" as any,
                    condition: {
                        field: "age",
                        operator: "eq",
                        value: 25,
                    },
                }),
            ).rejects.toThrow("array参数必须是数组类型");
        });

        it("应在condition缺失时抛出错误", async () => {
            await expect(
                adapter.arrayFilter({
                    array: testArray,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    condition: null as any,
                }),
            ).rejects.toThrow("condition参数结构错误");
        });

        it("应在不支持的操作符时抛出错误", async () => {
            await expect(
                adapter.arrayFilter({
                    array: testArray,
                    condition: {
                        field: "age",
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        operator: "invalid" as any,
                        value: 25,
                    },
                }),
            ).rejects.toThrow("不支持的操作符");
        });
    });

    describe("性能测试", () => {
        it("应在10ms内完成arrayAppend操作（1000元素）", async () => {
            const largeArray = Array.from({ length: 1000 }, (_, i) => i);
            const start = Date.now();

            const result = await adapter.arrayAppend({
                array: largeArray,
                item: 1000,
            });

            const duration = Date.now() - start;

            expect(result).toHaveLength(1001);
            expect(duration).toBeLessThan(10);
        });

        it("应在10ms内完成arrayFilter操作（1000元素）", async () => {
            const largeArray = Array.from({ length: 1000 }, (_, i) => ({ value: i }));
            const start = Date.now();

            const result = await adapter.arrayFilter({
                array: largeArray,
                condition: {
                    field: "value",
                    operator: "gt",
                    value: 500,
                },
            });

            const duration = Date.now() - start;

            expect(result.length).toBeGreaterThan(0);
            expect(duration).toBeLessThan(10);
        });

        it("应在超过100000元素时抛出错误", async () => {
            const hugeArray = Array.from({ length: 100000 }, (_, i) => i);

            await expect(
                adapter.arrayAppend({
                    array: hugeArray,
                    item: 100000,
                }),
            ).rejects.toThrow("数组过大");
        });
    });
});
