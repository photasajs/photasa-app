/**
 * 扫描工作流集成测试
 * 验证RFC 0045数组操作符合数据扁平化策略
 *
 * 注意：此测试直接测试BuiltinAdapter以验证工作流中使用的核心操作
 */

import { BuiltinAdapter } from "../../adapters/BuiltinAdapter";

describe("扫描工作流集成测试 - RFC 0045数组操作", () => {
    let adapter: BuiltinAdapter;

    beforeEach(async () => {
        adapter = new BuiltinAdapter();
        await adapter.initialize();
    });

    afterEach(async () => {
        await adapter.shutdown();
    });

    describe("add_scan_action.yml - arrayAppend工作流场景", () => {
        it("应该能够追加扫描任务到队列", async () => {
            // 模拟工作流步骤：restore_queue返回的数组
            const mockQueue = [
                { path: "/folder1", action: "scan", source: "manual", addedAt: 1000 },
            ];

            // 模拟工作流步骤：inputs.action
            const newAction = {
                path: "/folder2",
                action: "scan",
                source: "manual",
                addedAt: 2000,
            };

            // 执行arrayAppend（对应YAML中的步骤）
            const result = await adapter.arrayAppend({
                array: mockQueue,
                item: newAction,
            });

            // 验证结果符合数据扁平化策略：直接是数组
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(mockQueue[0]);
            expect(result[1]).toEqual(newAction);
        });
    });

    describe("remove_scan_action.yml - arrayFilter工作流场景", () => {
        it("应该能够从队列移除扫描任务", async () => {
            // 模拟工作流步骤：restore_queue返回的数组
            const mockQueue = [
                { path: "/folder1", action: "scan", source: "manual", addedAt: 1000 },
                { path: "/folder2", action: "scan", source: "manual", addedAt: 2000 },
                { path: "/folder3", action: "scan", source: "manual", addedAt: 3000 },
            ];

            // 模拟工作流步骤：inputs.path
            const pathToRemove = "/folder2";

            // 执行arrayFilter（对应YAML中的步骤）
            const result = await adapter.arrayFilter({
                array: mockQueue,
                condition: {
                    field: "path",
                    operator: "ne",
                    value: pathToRemove,
                },
            });

            // 验证结果符合数据扁平化策略：直接是数组
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(result.find((item: any) => item.path === "/folder1")).toBeDefined();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(result.find((item: any) => item.path === "/folder3")).toBeDefined();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(result.find((item: any) => item.path === pathToRemove)).toBeUndefined();
        });
    });

    describe("get_scanning_queue.yml - arrayCount工作流场景", () => {
        it("应该能够计算队列大小", async () => {
            // 模拟工作流步骤：restore_queue返回的数组
            const mockQueue = [
                { path: "/folder1", action: "scan", source: "manual", addedAt: 1000 },
                { path: "/folder2", action: "scan", source: "manual", addedAt: 2000 },
                { path: "/folder3", action: "scan", source: "manual", addedAt: 3000 },
            ];

            // 执行arrayCount（对应YAML中的步骤）
            const result = await adapter.arrayCount({
                array: mockQueue,
            });

            // 验证结果符合数据扁平化策略：直接是数字
            expect(typeof result).toBe("number");
            expect(result).toBe(3);
        });

        it("应该能够计算空队列大小", async () => {
            const mockQueue: unknown[] = [];

            const result = await adapter.arrayCount({
                array: mockQueue,
            });

            expect(result).toBe(0);
        });
    });

    describe("数据扁平化策略验证", () => {
        it("arrayAppend应该直接返回数组而不是包装对象", async () => {
            const result = await adapter.arrayAppend({
                array: [1, 2],
                item: 3,
            });

            // 关键验证：直接是数组，不是 {success, result} 对象
            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual([1, 2, 3]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((result as any).success).toBeUndefined();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((result as any).result).toBeUndefined();
        });

        it("arrayCount应该直接返回数字而不是包装对象", async () => {
            const result = await adapter.arrayCount({
                array: [1, 2, 3],
            });

            // 关键验证：直接是数字，不是 {success, result} 对象
            expect(typeof result).toBe("number");
            expect(result).toBe(3);
        });

        it("arrayFilter应该直接返回数组而不是包装对象", async () => {
            const result = await adapter.arrayFilter({
                array: [
                    { id: 1, value: 10 },
                    { id: 2, value: 20 },
                ],
                condition: {
                    field: "value",
                    operator: "gt",
                    value: 15,
                },
            });

            // 关键验证：直接是数组，不是 {success, result} 对象
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((result as any).success).toBeUndefined();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((result as any).result).toBeUndefined();
        });
    });

    describe("纯函数验证", () => {
        it("arrayAppend不应该修改原数组", async () => {
            const original = [1, 2, 3];
            const originalCopy = [...original];

            await adapter.arrayAppend({
                array: original,
                item: 4,
            });

            // 验证原数组未被修改
            expect(original).toEqual(originalCopy);
        });

        it("arrayFilter不应该修改原数组", async () => {
            const original = [
                { id: 1, value: 10 },
                { id: 2, value: 20 },
            ];
            const originalCopy = JSON.parse(JSON.stringify(original));

            await adapter.arrayFilter({
                array: original,
                condition: {
                    field: "value",
                    operator: "gt",
                    value: 15,
                },
            });

            // 验证原数组未被修改
            expect(original).toEqual(originalCopy);
        });
    });
});
