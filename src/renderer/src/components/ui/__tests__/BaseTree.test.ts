import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import BaseTree from "../BaseTree.vue";
import type { TreeNode } from "../BaseTree.vue";

// Mock VirtualList component
vi.mock("../VirtualList.vue", () => ({
    default: {
        name: "VirtualList",
        props: ["items", "itemHeight", "containerHeight", "getItemKey"],
        template: `
            <div class="mock-virtual-list">
                <div v-for="(item, index) in items" :key="getItemKey ? getItemKey(item) : index">
                    <slot :item="item" :index="index" />
                </div>
            </div>
        `,
    },
}));

// Mock BaseTreeNode component
vi.mock("../BaseTreeNode.vue", () => ({
    default: {
        name: "BaseTreeNode",
        props: [
            "node",
            "level",
            "isExpanded",
            "isSelected",
            "isChecked",
            "isHalfChecked",
            "checkable",
            "selectable",
            "showIcon",
            "showLine",
            "disabled",
            "blockNode",
            "virtual",
        ],
        emits: ["expand", "select", "check", "click", "dblclick", "contextmenu"],
        template: `
            <div class="mock-tree-node" :data-key="node.key" :data-level="level">
                {{ node.title }}
                <slot name="title" :node="node" :key="node.key" :title="node.title" />
            </div>
        `,
    },
}));

describe("BaseTree", () => {
    // 测试数据
    const createTestData = (): TreeNode[] => [
        {
            key: "folder1",
            title: "Folder 1",
            children: [
                { key: "file1", title: "File 1" },
                { key: "file2", title: "File 2" },
            ],
        },
        {
            key: "folder2",
            title: "Folder 2",
            children: [
                {
                    key: "subfolder1",
                    title: "Subfolder 1",
                    children: [{ key: "subfile1", title: "Subfile 1" }],
                },
            ],
        },
        { key: "file3", title: "File 3" },
    ];

    const createDuplicateKeyData = (): TreeNode[] => [
        {
            key: "folder1",
            title: "Folder 1",
            children: [
                { key: "duplicate", title: "File 1" },
                { key: "duplicate", title: "File 2" }, // 重复的 key
            ],
        },
        { key: "folder1", title: "Folder 1 Duplicate" }, // 重复的 key
    ];

    describe("基础渲染", () => {
        it("应该正确渲染树结构", () => {
            const treeData = createTestData();
            const wrapper = mount(BaseTree, {
                props: {
                    treeData,
                    virtual: false,
                },
            });

            expect(wrapper.find(".base-tree").exists()).toBe(true);
        });

        it("应该处理空数据", () => {
            const wrapper = mount(BaseTree, {
                props: {
                    treeData: [],
                    virtual: false,
                },
            });

            expect(wrapper.find(".base-tree").exists()).toBe(true);
        });
    });

    describe("虚拟化模式", () => {
        it("应该在虚拟化模式下渲染", () => {
            const treeData = createTestData();
            const wrapper = mount(BaseTree, {
                props: {
                    treeData,
                    virtual: true,
                    height: 400,
                },
            });

            expect(wrapper.find(".mock-virtual-list").exists()).toBe(true);
        });

        it("应该正确计算扁平化节点", async () => {
            const treeData = createTestData();
            const wrapper = mount(BaseTree, {
                props: {
                    treeData,
                    virtual: true,
                    expandedKeys: ["folder1", "folder2", "subfolder1"],
                },
            });

            await nextTick();

            // 检查扁平化后是否包含所有展开的节点
            const virtualList = wrapper.findComponent({ name: "VirtualList" });
            const items = virtualList.props("items");

            // 应该包含所有节点（包括展开的子节点）
            expect(items.length).toBeGreaterThan(3);

            // 检查是否包含根节点
            const rootKeys = items.map((item: any) => item.key);
            expect(rootKeys).toContain("folder1");
            expect(rootKeys).toContain("folder2");
            expect(rootKeys).toContain("file3");
        });

        it("应该正确处理节点展开状态", async () => {
            const treeData = createTestData();
            const expandedKeys = ["folder1"];

            const wrapper = mount(BaseTree, {
                props: {
                    treeData,
                    virtual: true,
                    expandedKeys,
                },
            });

            await nextTick();

            const virtualList = wrapper.findComponent({ name: "VirtualList" });
            const items = virtualList.props("items");

            // 应该包含 folder1 的子节点
            const keys = items.map((item: any) => item.key);
            expect(keys).toContain("file1");
            expect(keys).toContain("file2");

            // 不应该包含 folder2 的子节点（未展开）
            expect(keys).not.toContain("subfile1");
        });
    });

    describe("数据验证", () => {
        it("应该检测重复的 key", () => {
            const treeData = createDuplicateKeyData();

            // 这个测试验证我们能够识别重复的 key
            const keys = new Set<string>();
            const duplicates = new Set<string>();

            const checkKeys = (nodes: TreeNode[]) => {
                for (const node of nodes) {
                    if (keys.has(node.key as string)) {
                        duplicates.add(node.key as string);
                    }
                    keys.add(node.key as string);

                    if (node.children) {
                        checkKeys(node.children);
                    }
                }
            };

            checkKeys(treeData);

            expect(duplicates.size).toBeGreaterThan(0);
            expect(duplicates.has("duplicate")).toBe(true);
            expect(duplicates.has("folder1")).toBe(true);
        });

        it("应该正确处理深嵌套结构", () => {
            const deepData: TreeNode[] = [
                {
                    key: "root",
                    title: "Root",
                    children: Array.from({ length: 100 }, (_, i) => ({
                        key: `child-${i}`,
                        title: `Child ${i}`,
                        children: Array.from({ length: 10 }, (_, j) => ({
                            key: `child-${i}-${j}`,
                            title: `Grandchild ${i}-${j}`,
                        })),
                    })),
                },
            ];

            const wrapper = mount(BaseTree, {
                props: {
                    treeData: deepData,
                    virtual: true,
                    expandedKeys: ["root"],
                },
            });

            expect(wrapper.find(".base-tree").exists()).toBe(true);
        });
    });

    describe("事件处理", () => {
        it("应该正确触发展开事件", async () => {
            const treeData = createTestData();
            const wrapper = mount(BaseTree, {
                props: {
                    treeData,
                    virtual: false,
                },
            });

            // 模拟节点展开
            const treeNode = wrapper.findComponent({ name: "BaseTreeNode" });
            await treeNode.vm.$emit("expand", treeData[0], true);

            expect(wrapper.emitted("expand")).toBeTruthy();
            expect(wrapper.emitted("update:expandedKeys")).toBeTruthy();
        });

        it("应该正确触发选择事件", async () => {
            const treeData = createTestData();
            const wrapper = mount(BaseTree, {
                props: {
                    treeData,
                    virtual: false,
                },
            });

            // 模拟节点选择
            const treeNode = wrapper.findComponent({ name: "BaseTreeNode" });
            await treeNode.vm.$emit("select", treeData[0], true, new Event("click"));

            expect(wrapper.emitted("select")).toBeTruthy();
            expect(wrapper.emitted("update:selectedKeys")).toBeTruthy();
        });
    });

    describe("Props 验证", () => {
        it("应该接受所有必要的 props", () => {
            const treeData = createTestData();
            const wrapper = mount(BaseTree, {
                props: {
                    treeData,
                    virtual: true,
                    height: 400,
                    itemHeight: 28,
                    multiple: true,
                    checkable: true,
                    selectable: true,
                    showIcon: true,
                    showLine: false,
                    disabled: false,
                },
            });

            expect(wrapper.props("virtual")).toBe(true);
            expect(wrapper.props("height")).toBe(400);
            expect(wrapper.props("itemHeight")).toBe(28);
        });
    });

    describe("高度计算", () => {
        it("应该处理数字类型的高度", () => {
            const treeData = createTestData();
            const wrapper = mount(BaseTree, {
                props: {
                    treeData,
                    virtual: true,
                    height: 500,
                },
            });

            const virtualList = wrapper.findComponent({ name: "VirtualList" });
            expect(virtualList.props("containerHeight")).toBe(500);
        });

        it("应该处理字符串类型的高度", async () => {
            const treeData = createTestData();

            // Mock getBoundingClientRect
            const mockGetBoundingClientRect = vi.fn(
                () =>
                    ({
                        height: 600,
                        width: 300,
                        top: 0,
                        left: 0,
                        bottom: 600,
                        right: 300,
                        x: 0,
                        y: 0,
                        toJSON: () => ({}),
                    }) as DOMRect,
            );

            const wrapper = mount(BaseTree, {
                props: {
                    treeData,
                    virtual: true,
                    height: "100%",
                },
                attachTo: document.body,
            });

            // 获取容器元素
            const container = wrapper.find(".base-tree").element as HTMLElement;
            container.getBoundingClientRect = mockGetBoundingClientRect;

            await nextTick();

            expect(mockGetBoundingClientRect).toHaveBeenCalled();
        });
    });
});

// 辅助函数测试
describe("BaseTree 辅助函数", () => {
    describe("扁平化算法", () => {
        it("应该正确扁平化树结构", () => {
            const treeData: TreeNode[] = [
                {
                    key: "a",
                    title: "A",
                    children: [
                        { key: "a1", title: "A1" },
                        { key: "a2", title: "A2" },
                    ],
                },
                { key: "b", title: "B" },
            ];

            // 模拟扁平化逻辑
            const expandedKeys = new Set(["a"]);
            const flatten = (
                nodes: TreeNode[],
                level = 0,
            ): Array<{ key: string; level: number }> => {
                const result: Array<{ key: string; level: number }> = [];

                for (const node of nodes) {
                    result.push({ key: node.key as string, level });

                    if (node.children && expandedKeys.has(node.key as string)) {
                        result.push(...flatten(node.children, level + 1));
                    }
                }

                return result;
            };

            const flattened = flatten(treeData);

            expect(flattened).toHaveLength(4); // a, a1, a2, b
            expect(flattened[0]).toEqual({ key: "a", level: 0 });
            expect(flattened[1]).toEqual({ key: "a1", level: 1 });
            expect(flattened[2]).toEqual({ key: "a2", level: 1 });
            expect(flattened[3]).toEqual({ key: "b", level: 0 });
        });
    });
});
