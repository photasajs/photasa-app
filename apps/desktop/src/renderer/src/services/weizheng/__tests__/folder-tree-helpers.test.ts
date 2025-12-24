/**
 * 文件夹树辅助函数单元测试
 * 测试纯函数的文件夹树处理逻辑
 *
 * @since 2025-01-23
 */

import { describe, it, expect } from "vitest";
import {
    isRootPath,
    findRootPathForPath,
    isRootNodeExists,
    determineRootPathToAdd,
} from "../folder-tree-helpers";
import type { FolderNode } from "@common/folder-types";

describe("文件夹树辅助函数（纯函数）", () => {
    const createTestTree = (paths: string[]): FolderNode[] => {
        return paths.map((path) => ({
            key: path,
            title: path,
            children: [],
        }));
    };

    describe("isRootPath", () => {
        it("应该正确识别根路径", () => {
            const rootPaths = ["/root1", "/root2"];
            expect(isRootPath("/root1", rootPaths)).toBe(true);
            expect(isRootPath("/root2", rootPaths)).toBe(true);
            expect(isRootPath("/root3", rootPaths)).toBe(false);
        });

        it("应该处理空数组", () => {
            expect(isRootPath("/root1", [])).toBe(false);
        });
    });

    describe("findRootPathForPath", () => {
        it("应该找到精确匹配的根路径", () => {
            const rootPaths = ["/root1", "/root2"];
            expect(findRootPathForPath("/root1", rootPaths)).toBe("/root1");
        });

        it("应该找到子路径对应的根路径", () => {
            const rootPaths = ["/root1", "/root2"];
            expect(findRootPathForPath("/root1/subfolder", rootPaths)).toBe("/root1");
            expect(findRootPathForPath("/root2/subfolder/nested", rootPaths)).toBe("/root2");
        });

        it("应该返回null如果找不到匹配的根路径", () => {
            const rootPaths = ["/root1", "/root2"];
            expect(findRootPathForPath("/other/path", rootPaths)).toBe(null);
        });

        it("应该处理空数组", () => {
            expect(findRootPathForPath("/root1", [])).toBe(null);
        });
    });

    describe("isRootNodeExists", () => {
        it("应该正确检测根节点是否存在", () => {
            const tree = createTestTree(["/root1", "/root2"]);
            expect(isRootNodeExists(tree, "/root1")).toBe(true);
            expect(isRootNodeExists(tree, "/root2")).toBe(true);
            expect(isRootNodeExists(tree, "/root3")).toBe(false);
        });

        it("应该处理空树", () => {
            expect(isRootNodeExists([], "/root1")).toBe(false);
        });
    });

    describe("determineRootPathToAdd", () => {
        it("应该返回根路径如果它是根路径且不存在", () => {
            const rootPaths = ["/root1", "/root2"];
            const tree = createTestTree([]);
            expect(determineRootPathToAdd("/root1", rootPaths, tree)).toBe("/root1");
        });

        it("应该返回null如果根路径已存在", () => {
            const rootPaths = ["/root1", "/root2"];
            const tree = createTestTree(["/root1"]);
            expect(determineRootPathToAdd("/root1", rootPaths, tree)).toBe(null);
        });

        it("应该返回子路径对应的根路径如果根节点不存在", () => {
            const rootPaths = ["/root1", "/root2"];
            const tree = createTestTree([]);
            expect(determineRootPathToAdd("/root1/subfolder", rootPaths, tree)).toBe("/root1");
        });

        it("应该返回null如果子路径对应的根节点已存在", () => {
            const rootPaths = ["/root1", "/root2"];
            const tree = createTestTree(["/root1"]);
            expect(determineRootPathToAdd("/root1/subfolder", rootPaths, tree)).toBe(null);
        });

        it("应该返回null如果路径不是根路径且找不到对应的根路径", () => {
            const rootPaths = ["/root1", "/root2"];
            const tree = createTestTree([]);
            expect(determineRootPathToAdd("/other/path", rootPaths, tree)).toBe(null);
        });

        it("应该处理空数组和空树", () => {
            expect(determineRootPathToAdd("/root1", [], [])).toBe(null);
        });
    });
});
