import { describe, it, expect, beforeAll } from "vitest";
import {
    collectAncestorKeys,
    collectAllFolderKeys,
    mergeExpandedKeysForCurrentFolder,
    collectAncestorKeysFromTree,
    mergeExpandedKeysForCurrentFolderInTree,
    mergeExpandedKeysForNewFolders,
} from "../folder-tree-expand";
import type { FolderNode } from "@photasa/common";

beforeAll(() => {
    (globalThis as Record<string, unknown>).window = Object.assign(globalThis.window || {}, {
        api: {
            mergePath: (left: string, right: string) => left + (right ? `/${right}` : ""),
        },
    });
});

describe("folder-tree-expand", () => {
    it("collectAncestorKeys 应返回根到父级的路径", () => {
        const roots = ["/photos"];
        expect(collectAncestorKeys("/photos/vacation/2024", roots)).toEqual([
            "/photos",
            "/photos/vacation",
        ]);
    });

    it("collectAncestorKeys 对根路径仅返回根", () => {
        expect(collectAncestorKeys("/photos", ["/photos"])).toEqual(["/photos"]);
    });

    it("collectAllFolderKeys 应递归收集所有 key", () => {
        const tree: FolderNode[] = [
            {
                key: "/photos",
                title: "photos",
                children: [{ key: "/photos/vacation", title: "vacation", children: [] }],
            },
        ];
        expect(collectAllFolderKeys(tree)).toEqual(["/photos", "/photos/vacation"]);
    });

    it("mergeExpandedKeysForNewFolders 应合并祖先展开 key", () => {
        const result = mergeExpandedKeysForNewFolders(
            ["/photos"],
            ["/photos/vacation/2024"],
            ["/photos"],
        );
        expect(result).toContain("/photos");
        expect(result).toContain("/photos/vacation");
    });

    it("mergeExpandedKeysForCurrentFolder 启动恢复深路径时应展开祖先", () => {
        const result = mergeExpandedKeysForCurrentFolder(["/photos"], "/photos/vacation/2024", [
            "/photos",
        ]);
        expect(result).toContain("/photos");
        expect(result).toContain("/photos/vacation");
    });

    it("collectAncestorKeys 应规范化反斜杠路径", () => {
        expect(collectAncestorKeys("C:\\photos\\vacation", ["C:/photos"])).toEqual(["C:/photos"]);
    });

    it("collectAncestorKeys 空路径或无匹配根返回空数组", () => {
        expect(collectAncestorKeys("", ["/photos"])).toEqual([]);
        expect(collectAncestorKeys("/other/path", ["/photos"])).toEqual([]);
    });

    it("collectAllFolderKeys 空树返回空数组", () => {
        expect(collectAllFolderKeys([])).toEqual([]);
    });
});

describe("collectAncestorKeysFromTree / mergeExpandedKeysForCurrentFolderInTree", () => {
    const tree = [
        {
            key: "C:/p",
            title: "p",
            children: [{ key: "C:/p/a", title: "a", children: [{ key: "C:/p/a/b", title: "b" }] }],
        },
        { key: "C:/q", title: "q" },
    ];

    it("returns ancestor chain from tree without needing paths", () => {
        const winPath = ["C:", "p", "a", "b"].join(String.fromCharCode(92));
        expect(collectAncestorKeysFromTree(winPath, tree)).toEqual(["C:/p", "C:/p/a"]);
    });

    it("returns empty for empty, missing or root targets", () => {
        expect(collectAncestorKeysFromTree("", tree)).toEqual([]);
        expect(collectAncestorKeysFromTree("C:/zzz", tree)).toEqual([]);
        expect(collectAncestorKeysFromTree("C:/q", tree)).toEqual([]);
    });

    it("merges tree ancestors even when rootPaths is empty", () => {
        expect(mergeExpandedKeysForCurrentFolderInTree([], "C:/p/a/b", [], tree).sort()).toEqual([
            "C:/p",
            "C:/p/a",
        ]);
    });
});
