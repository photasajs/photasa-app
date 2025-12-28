import { addRoot, removeRoot, addFolderToTree, cleanDataNode } from "../folder-tree";
import type { FolderNode } from "@photasa/common";
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
    (globalThis as Record<string, unknown>).window = Object.assign(globalThis.window || {}, {
        api: {
            splitPath: (path: string) => path.split("/").filter(Boolean),
            mergePath: (left: string, right: string) => left + (right ? "/" + right : ""),
            getSeparator: () => "/",
            normalizePath: (path: string) => path,
            toFileName: (path: string) => path.split("/").pop() ?? "",
            toDirName: (path: string) => path.split("/").slice(0, -1).join("/"),
            isFileUnderFolder: (file: string, folder: string) => file.startsWith(folder),
            isHiddenFile: (path: string) => path.startsWith("."),
            isAbsolutePath: (path: string) => path.startsWith("/"),
            relativePath: (from: string, to: string) => to.replace(from, ""),
            resolvePath: (...segments: string[]) => segments.join("/"),
            getRoot: (path: string) => path.split("/")[0] || "",
        },
    });
});

describe("Folder Tree", () => {
    it("should build folder tree when root exists", () => {
        const roots: FolderNode[] = [];
        const path = "/test/google.com/test.jpg";

        // 先添加根节点
        addRoot(roots, "/test");
        // 然后构建子树
        addFolderToTree(roots, {
            path,
            thumbnail: "/test/google.com/.picasaoriginals/test.jpg",
            isVideo: false,
        });
        expect(roots).toMatchSnapshot();
    });

    it("should handle empty roots and empty path", () => {
        const roots: FolderNode[] = [];
        addFolderToTree(roots, { path: "", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should not add root nodes when roots array is empty", () => {
        const roots: FolderNode[] = [];
        addFolderToTree(roots, { path: "root1", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root2", thumbnail: "", isVideo: false });
        // 设计原则：addFolderToTree 不创建根节点，只在现有根下构建子树
        expect(roots.length).toBe(0);
    });

    it("should add deep nested nodes when root exists", () => {
        const roots: FolderNode[] = [];
        // 先添加根节点
        addRoot(roots, "root1");
        // 然后构建子树
        addFolderToTree(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root1/child1/child2", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should not add duplicate root nodes", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "root1");
        addRoot(roots, "root1");
        // addRoot不会添加重复的根节点
        expect(roots.length).toBe(1);
        expect(roots[0].key).toBe("root1");
    });

    it("should not add child if root does not exist (strict root control)", () => {
        const roots: FolderNode[] = [];
        addFolderToTree(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        // 根节点不存在时，不应该添加任何节点（保持roots为空）
        // 设计原则：只有用户主动添加的路径才能成为根节点
        expect(roots.length).toBe(0);
    });

    it("should clean node at various levels", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "root1");
        addFolderToTree(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root1/child1/child2", thumbnail: "", isVideo: false });
        cleanDataNode(roots, { path: "root1/child1/child2", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
        cleanDataNode(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should not change roots when cleaning non-existent node", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "root1");
        cleanDataNode(roots, { path: "root1/childX", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should clean deep nested children recursively", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "root1");
        addFolderToTree(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root1/child1/child2", thumbnail: "", isVideo: false });
        addFolderToTree(roots, {
            path: "root1/child1/child2/child3",
            thumbnail: "",
            isVideo: false,
        });
        cleanDataNode(roots, { path: "root1/child1/child2/child3", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should remove root node from tree", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "root1");
        addRoot(roots, "root2");
        addRoot(roots, "root3");
        expect(roots.length).toBe(3);
        removeRoot(roots, "root2");
        expect(roots.length).toBe(2);
        expect(roots[0].key).toBe("root1");
        expect(roots[1].key).toBe("root3");
    });

    it("should remove root node and all its children", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "root1");
        addFolderToTree(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root1/child1/child2", thumbnail: "", isVideo: false });
        expect(roots.length).toBe(1);
        expect(roots[0].children?.length).toBeGreaterThan(0);
        removeRoot(roots, "root1");
        expect(roots.length).toBe(0);
    });

    it("should not throw error when removing non-existent root", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "root1");
        expect(roots.length).toBe(1);
        removeRoot(roots, "root2");
        expect(roots.length).toBe(1);
        expect(roots[0].key).toBe("root1");
    });

    it("should handle removing from empty tree", () => {
        const roots: FolderNode[] = [];
        removeRoot(roots, "root1");
        expect(roots.length).toBe(0);
    });
});
