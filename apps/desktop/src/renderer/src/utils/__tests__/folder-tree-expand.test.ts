import { describe, it, expect, beforeAll } from "vitest";
import {
    collectAncestorKeys,
    collectAllFolderKeys,
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
});
