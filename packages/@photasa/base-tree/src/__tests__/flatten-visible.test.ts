import { describe, it, expect } from "vitest";
import {
    dedupeVisibleNodes,
    extractAllTreeKeys,
    flattenVisibleTreeNodes,
} from "../flatten-visible";
import type { TreeNode } from "../types";

describe("flattenVisibleTreeNodes", () => {
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

    it("flattens expanded branches only", () => {
        const flattened = flattenVisibleTreeNodes(treeData, new Set(["a"]));

        expect(flattened.map((node) => ({ key: node.key, level: node.level }))).toEqual([
            { key: "a", level: 0 },
            { key: "a1", level: 1 },
            { key: "a2", level: 1 },
            { key: "b", level: 0 },
        ]);
    });

    it("keeps collapsed children hidden", () => {
        const flattened = flattenVisibleTreeNodes(treeData, new Set());

        expect(flattened.map((node) => node.key)).toEqual(["a", "b"]);
    });
});

describe("dedupeVisibleNodes", () => {
    it("keeps first occurrence when keys repeat", () => {
        const nodes = dedupeVisibleNodes([
            {
                key: "dup",
                title: "first",
                level: 0,
                isVisible: true,
                hasChildren: false,
                isExpanded: false,
                originalNode: { key: "dup", title: "first" },
            },
            {
                key: "dup",
                title: "second",
                level: 1,
                isVisible: true,
                hasChildren: false,
                isExpanded: false,
                originalNode: { key: "dup", title: "second" },
            },
        ]);

        expect(nodes).toHaveLength(1);
        expect(nodes[0]?.title).toBe("first");
    });
});

describe("extractAllTreeKeys", () => {
    it("collects keys depth-first", () => {
        const keys = extractAllTreeKeys([
            {
                key: "root",
                title: "Root",
                children: [{ key: "child", title: "Child" }],
            },
        ]);

        expect(keys).toEqual(["root", "child"]);
    });
});
