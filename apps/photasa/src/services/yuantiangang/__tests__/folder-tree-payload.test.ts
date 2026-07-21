import { describe, it, expect } from "vitest";
import { extractFolderTreeFromContext } from "../folder-tree-payload";

describe("folder-tree-payload", () => {
    it("extractFolderTreeFromContext 要求 tree 数组", () => {
        expect(extractFolderTreeFromContext({ tree: [{ key: "/a" }] })).toEqual([{ key: "/a" }]);
        expect(() => extractFolderTreeFromContext({ tree: "bad" })).toThrow(
            "update_folder_tree 缺少 tree 数组",
        );
    });
});
