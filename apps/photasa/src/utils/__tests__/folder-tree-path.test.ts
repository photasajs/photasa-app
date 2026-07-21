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
});
