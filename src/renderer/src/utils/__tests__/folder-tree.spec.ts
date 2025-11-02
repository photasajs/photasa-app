import { addFolderToTree, cleanDataNode } from "../folder-tree";
import type { FolderNode } from "@common/folder-types";
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
    (globalThis as any).window = Object.assign(globalThis.window || {}, {
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
    it("should return a FolderNode", () => {
        const roots: FolderNode[] = [];
        const path = "/test/google.com/test.jpg";

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

    it("should add multiple root nodes", () => {
        const roots: FolderNode[] = [];
        addFolderToTree(roots, { path: "root1", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root2", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should add deep nested nodes", () => {
        const roots: FolderNode[] = [];
        addFolderToTree(roots, { path: "root1", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root1/child1/child2", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should not add duplicate nodes", () => {
        const roots: FolderNode[] = [];
        addFolderToTree(roots, { path: "root1", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root1", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should not add child if root does not exist", () => {
        const roots: FolderNode[] = [];
        addFolderToTree(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should clean node at various levels", () => {
        const roots: FolderNode[] = [];
        addFolderToTree(roots, { path: "root1", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root1/child1/child2", thumbnail: "", isVideo: false });
        cleanDataNode(roots, { path: "root1/child1/child2", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
        cleanDataNode(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should not change roots when cleaning non-existent node", () => {
        const roots: FolderNode[] = [];
        addFolderToTree(roots, { path: "root1", thumbnail: "", isVideo: false });
        cleanDataNode(roots, { path: "root1/childX", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });

    it("should clean deep nested children recursively", () => {
        const roots: FolderNode[] = [];
        addFolderToTree(roots, { path: "root1", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root1/child1/child2", thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "root1/child1/child2/child3", thumbnail: "", isVideo: false });
        cleanDataNode(roots, { path: "root1/child1/child2/child3", thumbnail: "", isVideo: false });
        expect(roots).toMatchSnapshot();
    });
});
