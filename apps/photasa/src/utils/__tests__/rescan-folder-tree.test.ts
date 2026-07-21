import { describe, it, expect } from "vitest";
import type { FolderNode } from "@photasa/common";
import { addRoot } from "@renderer/utils/folder-tree";
import {
    mergeDiscoveredPathsIntoTree,
    simulateRescanDirectoryDiscoveries,
} from "../folder-tree-discovered-paths";

const WATCH_ROOT = "/Volumes/SUCAI/Test";
const YEAR_2026 = `${WATCH_ROOT}/2026`;
const DAY_20260103 = `${YEAR_2026}/20260103`;
const DAY_20260131 = `${YEAR_2026}/20260131`;

function emptyTreeWithWatchRoot(): FolderNode[] {
    const tree: FolderNode[] = [];
    addRoot(tree, WATCH_ROOT);
    return tree;
}

function childKeysUnder(tree: FolderNode[], parentKey: string): string[] {
    const walk = (nodes: FolderNode[]): FolderNode | undefined => {
        for (const node of nodes) {
            if (node.key === parentKey) {
                return node;
            }
            const found = node.children ? walk(node.children) : undefined;
            if (found) {
                return found;
            }
        }
        return undefined;
    };
    const parent = walk(tree);
    return (parent?.children ?? []).map((c) => String(c.key));
}

describe("rescan → folderTree（Test / 2026 / 子目录）", () => {
    it("阶段1: rescan Test 发现 2026 → 树中应有 2026", () => {
        const tree = emptyTreeWithWatchRoot();
        const discoveries = simulateRescanDirectoryDiscoveries(WATCH_ROOT, {
            [WATCH_ROOT]: [YEAR_2026],
        });

        mergeDiscoveredPathsIntoTree(tree, discoveries, [WATCH_ROOT]);

        expect(childKeysUnder(tree, WATCH_ROOT)).toContain(YEAR_2026);
        expect(childKeysUnder(tree, YEAR_2026)).toEqual([]);
    });

    it("阶段2: rescan 2026 发现日期子夹 → 树中应有 20260103 / 20260131", () => {
        const tree = emptyTreeWithWatchRoot();
        const discoveries = simulateRescanDirectoryDiscoveries(WATCH_ROOT, {
            [WATCH_ROOT]: [YEAR_2026],
            [YEAR_2026]: [DAY_20260103, DAY_20260131],
        });

        mergeDiscoveredPathsIntoTree(tree, discoveries, [WATCH_ROOT]);

        expect(childKeysUnder(tree, WATCH_ROOT)).toContain(YEAR_2026);
        const under2026 = childKeysUnder(tree, YEAR_2026);
        expect(under2026).toContain(DAY_20260103);
        expect(under2026).toContain(DAY_20260131);
    });

    it("仅 rescan 父目录一层时：不会有 2026 的子目录（说明必须扫 2026 或做 BFS reconcile）", () => {
        const tree = emptyTreeWithWatchRoot();
        const discoveries = simulateRescanDirectoryDiscoveries(WATCH_ROOT, {
            [WATCH_ROOT]: [YEAR_2026],
        });

        mergeDiscoveredPathsIntoTree(tree, discoveries, [WATCH_ROOT]);

        expect(childKeysUnder(tree, YEAR_2026)).toEqual([]);
    });

    it("RFC 0136: 多次 add_paths 与一次批量等价", () => {
        const batchTree = emptyTreeWithWatchRoot();
        mergeDiscoveredPathsIntoTree(
            batchTree,
            [YEAR_2026, DAY_20260103, DAY_20260131],
            [WATCH_ROOT],
        );

        const stepTree = emptyTreeWithWatchRoot();
        for (const path of [YEAR_2026, DAY_20260103, DAY_20260131]) {
            mergeDiscoveredPathsIntoTree(stepTree, [path], [WATCH_ROOT]);
        }

        expect(batchTree).toEqual(stepTree);
    });

    it("重复 merge 同一批子目录不应复制兄弟节点（reconcile / scan 回归）", () => {
        const tree = emptyTreeWithWatchRoot();
        const subs = ["2018", "2020", "2021", "2023", "2025", "2026", "Luigi's Mension"].map(
            (name) => `${WATCH_ROOT}/${name}`,
        );

        const mergeOnce = () => mergeDiscoveredPathsIntoTree(tree, subs, [WATCH_ROOT]);
        mergeOnce();
        mergeOnce();
        mergeOnce();

        expect(childKeysUnder(tree, WATCH_ROOT).length).toBe(subs.length);
        expect(childKeysUnder(tree, WATCH_ROOT).sort()).toEqual(subs.sort());
    });
});
