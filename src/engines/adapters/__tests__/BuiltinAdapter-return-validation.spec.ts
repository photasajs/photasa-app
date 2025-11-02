/**
 * BuiltinAdapter return操作验证测试
 * 目的：防止YAML裸字符串input导致的类型不匹配问题
 *
 * 背景：
 * - 问题：YAML中 `input: "{{inputs.tree}}"` 被解析为对象键，导致return返回{}
 * - 修复：使用 `input: { data: "{{inputs.tree}}" }` 显式包装
 * - 此测试确保未来不会重现相同问题
 */

import { BuiltinAdapter } from "../BuiltinAdapter";
import type { FolderNode } from "@common/folder-types";

describe("BuiltinAdapter - return操作类型验证", () => {
    let adapter: BuiltinAdapter;

    beforeEach(async () => {
        adapter = new BuiltinAdapter();
        await adapter.initialize();
    });

    afterEach(async () => {
        await adapter.shutdown();
    });

    describe("正确的输入格式", () => {
        it("应正确处理对象包装的数组（推荐格式）", async () => {
            const testArray: FolderNode[] = [
                { key: "/test", title: "/test", children: [] },
                { key: "/test/child", title: "/test/child", children: [] },
            ];

            // ✅ 推荐格式：{ data: array }
            const result = await adapter.return({ data: testArray });

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual(testArray);
            expect(result.length).toBe(2);
        });

        it("应正确处理对象包装的对象", async () => {
            const testObject = {
                folderTree: [{ key: "/test", title: "/test", children: [] }],
                currentFolder: "/test",
                lastOpenedFolder: "/test",
            };

            // ✅ 推荐格式：{ data: object }
            const result = await adapter.return({ data: testObject });

            expect(typeof result).toBe("object");
            expect(result).toEqual(testObject);
        });

        it("应正确处理直接返回数据字段", async () => {
            const testData = { key1: "value1", key2: "value2" };

            // ✅ 替代格式：直接使用数据字段
            const result = await adapter.return(testData);

            // return会过滤掉控制字段(success, error, message, details)
            expect(result).toEqual(testData);
        });

        it("应正确处理成功标志和数据", async () => {
            const testData = [1, 2, 3];

            const result = await adapter.return({
                success: true,
                data: testData,
                message: "操作成功",
            });

            // 只返回data字段
            expect(result).toEqual(testData);
        });
    });

    describe("错误输入格式检测", () => {
        it("应识别空对象输入（YAML裸字符串导致的问题）", async () => {
            // ❌ 错误：YAML裸字符串 `input: "{{inputs.tree}}"` 导致的结果
            // 这会被YAML解析为 { "{{inputs.tree}}": null }
            // 经过BuiltinAdapter处理后返回 {}
            const result = await adapter.return({});

            // 当前行为：返回空对象
            expect(result).toEqual({});
            expect(Object.keys(result).length).toBe(0);
        });

        it("应识别意外的对象键", async () => {
            // 模拟YAML错误解析的情况
            const malformedInput = { "{{inputs.tree}}": null } as Record<string, unknown>;

            const result = await adapter.return(malformedInput);

            // return会返回整个对象（因为没有data字段）
            expect(result).toEqual({ "{{inputs.tree}}": null });
        });

        it("应在明确失败时抛出错误", async () => {
            await expect(
                adapter.return({
                    success: false,
                    message: "操作失败",
                }),
            ).rejects.toThrow("操作失败");
        });

        it("应在有error字段时抛出错误", async () => {
            await expect(
                adapter.return({
                    error: "发生错误",
                }),
            ).rejects.toThrow("发生错误");
        });
    });

    describe("数据类型保持", () => {
        it("应保持数组类型", async () => {
            const arrays = [[], [1, 2, 3], [{ id: 1 }, { id: 2 }], ["a", "b", "c"]];

            for (const arr of arrays) {
                const result = await adapter.return({ data: arr });
                expect(Array.isArray(result)).toBe(true);
                expect(result).toEqual(arr);
            }
        });

        it("应保持对象类型", async () => {
            const objects = [
                {},
                { key: "value" },
                { nested: { deep: { value: 123 } } },
                { array: [1, 2, 3], string: "test", number: 42 },
            ];

            for (const obj of objects) {
                const result = await adapter.return({ data: obj });
                expect(typeof result).toBe("object");
                expect(result).toEqual(obj);
            }
        });

        it("应保持基本类型", async () => {
            const primitives = [
                { data: "string", expected: "string" },
                { data: 123, expected: 123 },
                { data: true, expected: true },
                { data: null, expected: null },
            ];

            for (const { data, expected } of primitives) {
                const result = await adapter.return({ data });
                expect(result).toBe(expected);
            }
        });
    });

    describe("边界情况", () => {
        it("应处理undefined data字段", async () => {
            const result = await adapter.return({ data: undefined });

            // 当data为undefined时，返回非控制字段（即空对象，因为data被过滤）
            expect(result).toEqual({});
        });

        it("应处理没有data字段的情况", async () => {
            const customFields = {
                customField1: "value1",
                customField2: "value2",
            };

            const result = await adapter.return(customFields);

            // 返回所有非控制字段
            expect(result).toEqual(customFields);
        });

        it("应过滤控制字段", async () => {
            const input = {
                success: true,
                error: undefined,
                message: "测试消息",
                details: { extra: "info" },
                actualData: "这是真实数据",
                anotherField: 123,
            };

            const result = await adapter.return(input);

            // 应过滤掉 success, error, message, details
            expect(result).toEqual({
                actualData: "这是真实数据",
                anotherField: 123,
            });
        });
    });

    describe("实际工作流场景模拟", () => {
        it("应模拟update_folder_tree工作流的return步骤", async () => {
            // 模拟 steps.update_tree 的输出
            const folderTree: FolderNode[] = [
                { key: "/root", title: "/root", children: [] },
                { key: "/root/subfolder", title: "/root/subfolder", children: [] },
            ];

            // 正确的YAML格式：input: { data: "{{inputs.tree}}" }
            // 解析后传递给return的参数
            const result = await adapter.return({ data: folderTree });

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual(folderTree);
        });

        it("应模拟restore_app_state工作流的return步骤", async () => {
            // 模拟 steps.restore_app_state 的输出
            const appState = {
                folderTree: [{ key: "/restored", title: "/restored", children: [] }],
                currentFolder: "/restored",
                lastOpenedFolder: "/restored",
            };

            // 正确的YAML格式：input: { data: "{{steps.restore_app_state}}" }
            const result = await adapter.return({ data: appState });

            expect(typeof result).toBe("object");
            expect(result).toHaveProperty("folderTree");
            expect(result).toHaveProperty("currentFolder");
            expect(result).toHaveProperty("lastOpenedFolder");
        });
    });
});
