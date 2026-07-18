/**
 * BuiltinAdapter 扫描操作测试
 * RFC 0048 v3: 扫描状态机工作流支持
 */

import { BuiltinAdapter } from "../BuiltinAdapter";

describe("BuiltinAdapter - 扫描操作 (RFC 0048)", () => {
    let adapter: BuiltinAdapter;

    beforeEach(async () => {
        adapter = new BuiltinAdapter();
        await adapter.initialize();
    });

    afterEach(async () => {
        await adapter.shutdown();
    });

    describe("objectMerge - 对象合并", () => {
        it("应该合并两个对象", async () => {
            const result = await adapter.objectMerge({
                base: { a: 1 },
                updates: { b: 2 },
            });

            expect(result).toEqual({ a: 1, b: 2 });
        });

        it("应该覆盖同名属性", async () => {
            const result = await adapter.objectMerge({
                base: { a: 1, b: 2 },
                updates: { b: 3 },
            });

            expect(result).toEqual({ a: 1, b: 3 });
        });

        it("应该支持additional参数", async () => {
            const result = await adapter.objectMerge({
                base: { a: 1 },
                updates: { b: 2 },
                additional: { c: 3 },
            });

            expect(result).toEqual({ a: 1, b: 2, c: 3 });
        });

        it("应该正确处理优先级 (additional > updates > base)", async () => {
            const result = await adapter.objectMerge({
                base: { a: 1 },
                updates: { a: 2 },
                additional: { a: 3 },
            });

            expect(result).toEqual({ a: 3 });
        });

        it("应在base为null时抛出错误", async () => {
            await expect(
                adapter.objectMerge({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    base: null as any,
                    updates: {},
                }),
            ).rejects.toThrow("base参数不能为null或undefined");
        });

        it("应在base不是对象时抛出错误", async () => {
            await expect(
                adapter.objectMerge({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    base: "not an object" as any,
                    updates: {},
                }),
            ).rejects.toThrow("base参数必须是对象类型");
        });
    });

    describe("arraySet - 数组设值", () => {
        it("应该设置指定索引的值", async () => {
            const result = await adapter.arraySet({
                array: [1, 2, 3],
                index: 1,
                value: 4,
            });

            expect(result).toEqual([1, 4, 3]);
        });

        it("应该支持负数索引", async () => {
            const result = await adapter.arraySet({
                array: [1, 2, 3],
                index: -1,
                value: 4,
            });

            expect(result).toEqual([1, 2, 4]);
        });

        it("应该验证原数组不变（纯函数）", async () => {
            const original = [1, 2, 3];
            const result = await adapter.arraySet({
                array: original,
                index: 1,
                value: 4,
            });

            expect(result).toEqual([1, 4, 3]);
            expect(original).toEqual([1, 2, 3]);
        });

        it("应在索引越界时抛出错误", async () => {
            await expect(
                adapter.arraySet({
                    array: [1, 2, 3],
                    index: 3,
                    value: 4,
                }),
            ).rejects.toThrow("索引越界");
        });

        it("应在负数索引越界时抛出错误", async () => {
            await expect(
                adapter.arraySet({
                    array: [1, 2, 3],
                    index: -4,
                    value: 4,
                }),
            ).rejects.toThrow("索引越界");
        });

        it("应在array为null时抛出错误", async () => {
            await expect(
                adapter.arraySet({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    array: null as any,
                    index: 0,
                    value: 1,
                }),
            ).rejects.toThrow("array参数不能为null或undefined");
        });

        it("应在array不是数组时抛出错误", async () => {
            await expect(
                adapter.arraySet({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    array: "not an array" as any,
                    index: 0,
                    value: 1,
                }),
            ).rejects.toThrow("array参数必须是数组类型");
        });
    });
});
