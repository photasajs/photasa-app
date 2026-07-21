import { describe, it, expect } from "vitest";
import {
    canonicalFolderPath,
    findLongestRootKey,
    folderSegmentsUnderRoot,
    isPathUnderRoot,
    buildFolderKey,
    joinFolderSegment,
    resolveFolderNodeKey,
} from "../folder-tree-path";

describe("folder-tree-path", () => {
    it("isPathUnderRoot 应区分前缀与真实子路径", () => {
        expect(isPathUnderRoot("/Volumes/SUCAI/Test/2026", "/Volumes/SUCAI/Test")).toBe(true);
        expect(isPathUnderRoot("/Volumes/SUCAI/Test2026", "/Volumes/SUCAI/Test")).toBe(false);
    });

    it("findLongestRootKey 应选最长匹配根", () => {
        const roots = ["/Volumes/SUCAI", "/Volumes/SUCAI/Test"];
        expect(findLongestRootKey("/Volumes/SUCAI/Test/2026", roots)).toBe("/Volumes/SUCAI/Test");
    });

    it("folderSegmentsUnderRoot 应返回 2026", () => {
        expect(folderSegmentsUnderRoot("/Volumes/SUCAI/Test/2026", "/Volumes/SUCAI/Test")).toEqual([
            "2026",
        ]);
    });

    it("canonicalFolderPath 去掉末尾斜杠", () => {
        expect(canonicalFolderPath("/Volumes/SUCAI/Test/")).toBe("/Volumes/SUCAI/Test");
    });

    it("canonicalFolderPath 对非 string 返回空串", () => {
        expect(canonicalFolderPath(undefined)).toBe("");
        expect(canonicalFolderPath(null)).toBe("");
        expect(canonicalFolderPath(42)).toBe("");
        expect(canonicalFolderPath("")).toBe("");
        expect(canonicalFolderPath("   ")).toBe("");
    });

    it("buildFolderKey 拼接子目录", () => {
        expect(buildFolderKey("/Volumes/SUCAI/Test", ["2026"])).toBe("/Volumes/SUCAI/Test/2026");
    });

    it("buildFolderKey 不依赖 window.api.mergePath（Tauri mergePath 为 Promise）", () => {
        (globalThis as Record<string, unknown>).window = {
            api: {
                mergePath: () => Promise.resolve("SHOULD_NOT_BE_USED"),
            },
        };
        expect(buildFolderKey("/Volumes/SUCAI/Test", ["2026"])).toBe("/Volumes/SUCAI/Test/2026");
    });

    it("joinFolderSegment 同步拼接", () => {
        expect(joinFolderSegment("/Volumes/SUCAI/Test", "2026")).toBe("/Volumes/SUCAI/Test/2026");
    });

    it("resolveFolderNodeKey 应从 title 恢复 Promise 序列化后的 {} key", () => {
        expect(
            resolveFolderNodeKey("/Volumes/SUCAI/Test", {
                key: {},
                title: "2018",
            }),
        ).toBe("/Volumes/SUCAI/Test/2018");
    });

    it("joinFolderSegment 处理空段与非 string 段", () => {
        expect(joinFolderSegment("/Volumes/SUCAI/Test", "")).toBe("/Volumes/SUCAI/Test");
        expect(joinFolderSegment("", "2026")).toBe("");
        expect(joinFolderSegment("/Volumes/SUCAI/Test", 42 as unknown as string)).toBe(
            "/Volumes/SUCAI/Test",
        );
        expect(joinFolderSegment("/Volumes/SUCAI/Test", "/2026/")).toBe("/Volumes/SUCAI/Test/2026");
    });

    it("buildFolderKey 支持多段拼接", () => {
        expect(buildFolderKey("/Volumes/SUCAI/Test", ["2026", "20260103"])).toBe(
            "/Volumes/SUCAI/Test/2026/20260103",
        );
    });

    it("resolveFolderNodeKey 覆盖各分支", () => {
        expect(resolveFolderNodeKey("", { key: "2018" })).toBeNull();
        expect(
            resolveFolderNodeKey("/Volumes/SUCAI/Test", {
                key: "/Volumes/SUCAI/Test",
            }),
        ).toBe("/Volumes/SUCAI/Test");
        expect(
            resolveFolderNodeKey("/Volumes/SUCAI/Test", {
                key: "2018",
            }),
        ).toBe("/Volumes/SUCAI/Test/2018");
        expect(
            resolveFolderNodeKey("/Volumes/SUCAI/Test", {
                key: "/other/root/2018",
            }),
        ).toBe("/other/root/2018");
        expect(
            resolveFolderNodeKey("/Volumes/SUCAI/Test", {
                key: "[object Object]",
                title: "2018",
            }),
        ).toBe("/Volumes/SUCAI/Test/2018");
        expect(
            resolveFolderNodeKey("/Volumes/SUCAI/Test", {
                key: "[object Promise]",
            }),
        ).toBeNull();
        expect(
            resolveFolderNodeKey("/Volumes/SUCAI/Test", {
                key: "   ",
                title: "  ",
            }),
        ).toBeNull();
    });

    it("isPathUnderRoot 与 findLongestRootKey 空路径", () => {
        expect(isPathUnderRoot("", "/Volumes/SUCAI")).toBe(false);
        expect(isPathUnderRoot("/Volumes/SUCAI/Test", "")).toBe(false);
        expect(findLongestRootKey("/Volumes/Other", ["/Volumes/SUCAI"])).toBeNull();
    });

    it("folderSegmentsUnderRoot 根路径自身返回空数组", () => {
        expect(folderSegmentsUnderRoot("/Volumes/SUCAI/Test", "/Volumes/SUCAI/Test")).toEqual([]);
        expect(folderSegmentsUnderRoot("/Volumes/Other", "/Volumes/SUCAI/Test")).toEqual([]);
    });

    it("findLongestRootKey 较短根不应覆盖较长匹配", () => {
        const roots = ["/Volumes/SUCAI/Test", "/Volumes/SUCAI"];
        expect(findLongestRootKey("/Volumes/SUCAI/Test/2026", roots)).toBe("/Volumes/SUCAI/Test");
    });
});
