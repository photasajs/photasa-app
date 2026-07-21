import { describe, it, expect } from "vitest";
import {
    buildFolderKey,
    canonicalFolderPath,
    joinFolderSegment,
} from "@renderer/utils/folder-tree-path";
import {
    mergePathSync,
    normalizePathSync,
    splitPathSync,
    toFileNameSync,
} from "@renderer/utils/sync-path";

describe("sync-path", () => {
    it("normalizePathSync 统一斜杠并去除多余分隔符", () => {
        expect(normalizePathSync("/foo//bar\\baz")).toBe("/foo/bar/baz");
    });

    it("mergePathSync 同步拼接（不返回 Promise）", () => {
        expect(mergePathSync("/Volumes/Photos", "2024")).toBe("/Volumes/Photos/2024");
    });

    it("splitPathSync 与 joinFolderSegment 可用于 buildFolderKey", () => {
        const segments = splitPathSync("/Volumes/Photos/2024");
        expect(buildFolderKey("/Volumes/Photos", segments.slice(2))).toBe("/Volumes/Photos/2024");
    });

    it("toFileNameSync 提取文件名", () => {
        expect(toFileNameSync("/Volumes/Photos/a.jpg")).toBe("a.jpg");
    });

    it("canonicalFolderPath 与 normalizePathSync 语义一致", () => {
        const input = "/Volumes/SUCAI/Test/";
        expect(normalizePathSync(input)).toBe(canonicalFolderPath(input));
        expect(joinFolderSegment("/Volumes/SUCAI", "Test")).toBe("/Volumes/SUCAI/Test");
    });
});
