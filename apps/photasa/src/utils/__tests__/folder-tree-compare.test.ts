import { describe, expect, it, vi, beforeEach } from "vitest";
import { isSameFolderTree } from "../folder-tree-compare";
import type { FolderNode } from "@photasa/common";

describe("isSameFolderTree", () => {
    const treeWith2026: FolderNode[] = [
        {
            key: "/Volumes/SUCAI/Test",
            title: "/Volumes/SUCAI/Test",
            children: [
                {
                    key: "/Volumes/SUCAI/Test/2026",
                    title: "2026",
                    children: [],
                },
            ],
        },
    ];

    it("相同结构应返回 true", () => {
        const copy = JSON.parse(JSON.stringify(treeWith2026)) as FolderNode[];
        expect(isSameFolderTree(treeWith2026, copy)).toBe(true);
    });

    it("缺少子节点应返回 false", () => {
        const rootOnly: FolderNode[] = [
            {
                key: "/Volumes/SUCAI/Test",
                title: "/Volumes/SUCAI/Test",
                children: [],
            },
        ];
        expect(isSameFolderTree(treeWith2026, rootOnly)).toBe(false);
    });
});
