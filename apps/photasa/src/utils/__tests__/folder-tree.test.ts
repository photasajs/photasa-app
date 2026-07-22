import {
    addRoot,
    removeRoot,
    addFolderToTree,
    cleanDataNode,
    sanitizeFolderTree,
    dedupeFolderTree,
} from "../folder-tree";
import type { FolderNode } from "@photasa/common";
import { describe, it, expect, beforeAll, vi } from "vitest";

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

    it("RFC 0136: 应在 /Volumes 根下添加 2026 子目录", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "/Volumes/SUCAI/Test");
        addFolderToTree(roots, {
            path: "/Volumes/SUCAI/Test/2026",
            thumbnail: "",
            isVideo: false,
        });
        expect(roots[0].children?.[0]?.key).toBe("/Volumes/SUCAI/Test/2026");
        expect(roots[0].children?.[0]?.title).toBe("2026");
    });

    it("同一子目录重复添加不应产生重复兄弟节点", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "/Volumes/SUCAI/Test");
        const photo = { path: "/Volumes/SUCAI/Test/2018", thumbnail: "", isVideo: false };
        addFolderToTree(roots, photo);
        addFolderToTree(roots, photo);
        addFolderToTree(roots, photo);
        expect(roots[0].children?.length).toBe(1);
        expect(roots[0].children?.[0]?.key).toBe("/Volumes/SUCAI/Test/2018");
    });

    it("Tauri 异步 mergePath 下仍应正确去重（buildFolderKey 不得用 window.api）", () => {
        (globalThis as Record<string, unknown>).window = {
            api: {
                splitPath: (path: string) => path.split("/").filter(Boolean),
                mergePath: () => Promise.resolve("WRONG"),
                getSeparator: () => "/",
                normalizePath: (path: string) => path,
            },
        };
        const roots: FolderNode[] = [];
        addRoot(roots, "/Volumes/SUCAI/Test");
        const subs = ["2018", "2020", "2021", "2023", "2025", "2026"];
        for (const year of subs) {
            addFolderToTree(roots, {
                path: `/Volumes/SUCAI/Test/${year}`,
                thumbnail: "",
                isVideo: false,
            });
        }
        for (const year of subs) {
            addFolderToTree(roots, {
                path: `/Volumes/SUCAI/Test/${year}`,
                thumbnail: "",
                isVideo: false,
            });
        }
        expect(roots[0].children?.length).toBe(subs.length);
    });

    it("sanitizeFolderTree 应合并重复兄弟节点", () => {
        const roots: FolderNode[] = [
            {
                key: "/Volumes/SUCAI/Test",
                title: "/Volumes/SUCAI/Test",
                children: [
                    { key: "/Volumes/SUCAI/Test/2018", title: "2018", children: [] },
                    { key: "/Volumes/SUCAI/Test/2018", title: "2018", children: [] },
                    { key: "/Volumes/SUCAI/Test/2020", title: "2020", children: [] },
                    { key: "/Volumes/SUCAI/Test/2020", title: "2020", children: [] },
                ],
            },
        ];
        sanitizeFolderTree(roots);
        expect(roots[0].children?.length).toBe(2);
    });

    it("addRoot 忽略空路径", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "   ");
        expect(roots).toEqual([]);
    });

    it("addFolderToTree 忽略无效 path", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "/Volumes/SUCAI/Test");
        addFolderToTree(roots, { path: null as unknown as string, thumbnail: "", isVideo: false });
        addFolderToTree(roots, { path: "   ", thumbnail: "", isVideo: false });
        expect(roots[0].children?.length ?? 0).toBe(0);
    });

    it("cleanDataNode 对仅根级路径无操作", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "root1");
        cleanDataNode(roots, { path: "root1", thumbnail: "", isVideo: false });
        expect(roots.length).toBe(1);
    });

    it("dedupeFolderTree 委托 sanitizeFolderTree", () => {
        const roots: FolderNode[] = [
            {
                key: "/Volumes/SUCAI/Test",
                title: "/Volumes/SUCAI/Test",
                children: [
                    { key: "/Volumes/SUCAI/Test/2018", title: "2018", children: [] },
                    { key: "/Volumes/SUCAI/Test/2018", title: "2018", children: [] },
                ],
            },
        ];
        dedupeFolderTree(roots);
        expect(roots[0].children?.length).toBe(1);
    });

    it("addFolderToTree 复用已有子节点时规范化 key", () => {
        const roots: FolderNode[] = [
            {
                key: "/Volumes/SUCAI/Test",
                title: "/Volumes/SUCAI/Test",
                children: [{ key: "2018", title: "2018", children: [] }],
            },
        ];
        addFolderToTree(roots, {
            path: "/Volumes/SUCAI/Test/2018/nested",
            thumbnail: "",
            isVideo: false,
        });
        expect(roots[0].children?.[0]?.key).toBe("/Volumes/SUCAI/Test/2018");
        expect(roots[0].children?.[0]?.children?.[0]?.key).toBe("/Volumes/SUCAI/Test/2018/nested");
    });

    it("sanitizeFolderTree 为空 title 补全段名", () => {
        const roots: FolderNode[] = [
            {
                key: "/Volumes/SUCAI/Test",
                title: "/Volumes/SUCAI/Test",
                children: [{ key: "/Volumes/SUCAI/Test/2018", title: "  ", children: [] }],
            },
        ];
        sanitizeFolderTree(roots);
        expect(roots[0].children?.[0]?.title).toBe("2018");
    });

    it("cleanDataNode 直接删除一级子节点", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "root1");
        addFolderToTree(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        cleanDataNode(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        expect(roots[0].children?.length ?? 0).toBe(0);
    });

    it("sanitizeFolderTree 为空 title 的根级 key 补全 title", () => {
        const roots: FolderNode[] = [{ key: "/", title: "", children: [] }];
        sanitizeFolderTree(roots);
        expect(roots[0].title).toBe("/");
    });

    it("sanitizeFolderTree 跳过无法解析 key 的节点", () => {
        const roots: FolderNode[] = [
            { key: {} as unknown as string, title: "", children: [] },
            { key: "/Volumes/SUCAI/Test", title: "/Volumes/SUCAI/Test", children: [] },
        ];
        sanitizeFolderTree(roots);
        expect(roots.length).toBe(1);
        expect(roots[0].key).toBe("/Volumes/SUCAI/Test");
    });

    it("sanitizeFolderTree 合并时 existing 无 children", () => {
        const roots: FolderNode[] = [
            {
                key: "/Volumes/SUCAI/Test",
                title: "/Volumes/SUCAI/Test",
                children: [
                    { key: "/Volumes/SUCAI/Test/2018", title: "2018" },
                    {
                        key: "/Volumes/SUCAI/Test/2018",
                        title: "dup",
                        children: [
                            {
                                key: "/Volumes/SUCAI/Test/2018/nested",
                                title: "nested",
                                children: [],
                            },
                        ],
                    },
                ],
            },
        ];
        sanitizeFolderTree(roots);
        expect(roots[0].children?.length).toBe(1);
        expect(roots[0].children?.[0]?.children?.length).toBe(1);
    });

    it("sanitizeFolderTree 合并重复兄弟的子树", () => {
        const roots: FolderNode[] = [
            {
                key: "/Volumes/SUCAI/Test",
                title: "/Volumes/SUCAI/Test",
                children: [
                    {
                        key: "/Volumes/SUCAI/Test/2018",
                        title: "2018",
                        children: [
                            {
                                key: "/Volumes/SUCAI/Test/2018/a",
                                title: "a",
                                children: [],
                            },
                        ],
                    },
                    {
                        key: "/Volumes/SUCAI/Test/2018",
                        title: 2018 as unknown as string,
                        children: [
                            {
                                key: "/Volumes/SUCAI/Test/2018/b",
                                title: "b",
                                children: undefined,
                            },
                        ],
                    },
                ],
            },
        ];
        sanitizeFolderTree(roots);
        expect(roots[0].children?.length).toBe(1);
        expect(roots[0].children?.[0]?.children?.map((c) => c.key).sort()).toEqual([
            "/Volumes/SUCAI/Test/2018/a",
            "/Volumes/SUCAI/Test/2018/b",
        ]);
    });

    it("addFolderToTree 路径等于根时不添加子段", () => {
        const roots: FolderNode[] = [];
        addRoot(roots, "/Volumes/SUCAI/Test");
        addFolderToTree(roots, {
            path: "/Volumes/SUCAI/Test",
            thumbnail: "",
            isVideo: false,
        });
        expect(roots[0].children?.length ?? 0).toBe(0);
    });

    it("addFolderToTree 在找不到根节点时安全返回", async () => {
        vi.resetModules();
        vi.doMock("@renderer/utils/folder-tree-path", async (importOriginal) => {
            const actual =
                await importOriginal<typeof import("@renderer/utils/folder-tree-path")>();
            return {
                ...actual,
                findLongestRootKey: () => "/ghost-root",
            };
        });
        const { addFolderToTree: addWithMock } = await import("../folder-tree");
        const roots: FolderNode[] = [{ key: "/Volumes/SUCAI/Test", title: "Test", children: [] }];
        addWithMock(roots, {
            path: "/Volumes/SUCAI/Test/2018",
            thumbnail: "",
            isVideo: false,
        });
        expect(roots[0].children?.length ?? 0).toBe(0);
        vi.doUnmock("@renderer/utils/folder-tree-path");
        vi.resetModules();
    });

    it("addFolderToTree 在根 key 不一致时安全返回", () => {
        const roots: FolderNode[] = [{ key: "legacy-key", title: "legacy", children: [] }];
        addFolderToTree(roots, {
            path: "/Volumes/SUCAI/Test/2018",
            thumbnail: "",
            isVideo: false,
        });
        expect(roots[0].children?.length ?? 0).toBe(0);
    });

    it("cleanDataNode 在根无 children 时无操作", () => {
        const roots: FolderNode[] = [{ key: "root1", title: "root1" }];
        cleanDataNode(roots, { path: "root1/child1", thumbnail: "", isVideo: false });
        expect(roots[0].children).toBeUndefined();
    });

    it("traverseTree 为无 children 的节点补全数组", () => {
        const roots: FolderNode[] = [{ key: "/Volumes/SUCAI/Test", title: "Test" }];
        addFolderToTree(roots, {
            path: "/Volumes/SUCAI/Test/2018",
            thumbnail: "",
            isVideo: false,
        });
        expect(Array.isArray(roots[0].children)).toBe(true);
    });

    it("sanitizeFolderTree 应合并 Promise 序列化 {} 与全路径 2018", () => {
        const roots: FolderNode[] = [
            {
                key: "/Volumes/SUCAI/Test",
                title: "/Volumes/SUCAI/Test",
                children: [
                    { key: {} as unknown as string, title: "2018", children: [] },
                    {
                        key: "/Volumes/SUCAI/Test/2018",
                        title: "2018",
                        children: [
                            {
                                key: "/Volumes/SUCAI/Test/2018/20180901",
                                title: "20180901",
                                children: [],
                            },
                        ],
                    },
                ],
            },
        ];
        sanitizeFolderTree(roots);
        expect(roots[0].children?.length).toBe(1);
        expect(roots[0].children?.[0]?.key).toBe("/Volumes/SUCAI/Test/2018");
        expect(roots[0].children?.[0]?.children?.length).toBe(1);
    });

    it("sanitizeFolderTree 应从树中清理旧有 media 文件节点", () => {
        const roots: FolderNode[] = [
            {
                key: "/Volumes/SUCAI",
                title: "SUCAI",
                children: [
                    {
                        key: "/Volumes/SUCAI/20260520",
                        title: "20260520",
                        children: [
                            {
                                key: "/Volumes/SUCAI/20260520/20260520_145038.jpg",
                                title: "20260520_145038.jpg",
                            },
                            {
                                key: "/Volumes/SUCAI/20260520/20260520_145039.jpg",
                                title: "20260520_145039.jpg",
                            },
                            {
                                key: "/Volumes/SUCAI/20260520/subfolder",
                                title: "subfolder",
                                children: [],
                            },
                        ],
                    },
                ],
            },
        ];
        sanitizeFolderTree(roots);
        const children = roots[0].children?.[0]?.children;
        expect(children?.length).toBe(1);
        expect(children?.[0]?.title).toBe("subfolder");
    });
});
