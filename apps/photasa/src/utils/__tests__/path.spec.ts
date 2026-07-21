import { normalizePath, mergePath } from "../path";
import { describe, it, expect } from "vitest";

describe("normalizePath", () => {
    it("统一斜杠并规范化路径", () => {
        const path = "/Users/albert.li/Desktop";
        expect(normalizePath(path)).toBe("/Users/albert.li/Desktop");
    });

    it("去除多余斜杠", () => {
        expect(normalizePath("/foo//bar")).toBe("/foo/bar");
    });
});

describe("mergePath", () => {
    it("合并 posix 路径段", () => {
        expect(mergePath("/foo/bar", "baz")).toBe("/foo/bar/baz");
    });

    it("空 right 返回规范化 left", () => {
        expect(mergePath("/foo/bar", "")).toBe("/foo/bar");
    });
});
