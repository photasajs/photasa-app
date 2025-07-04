import { normalizePath } from "../path";
import { describe, it, expect, beforeAll } from "vitest";

// mock window.api.normalizePath for test environment
if (!window.api) {
    window.api = {} as any;
}
window.api.normalizePath = (p: string) => (p.endsWith("/") ? p : p + "/");
window.api.mergePath = (l: string, r = "") => l + (r ? "/" + r : "");

describe("normalizePath", () => {
    it("should append a slash to the end of the path", () => {
        const path = "/Users/albert.li/Desktop";
        expect(normalizePath(path)).toBe("/Users/albert.li/Desktop/");
    });
});

describe.each([
    ["win32", "C:\\foo\\bar", "C:\\foo\\bar\\"],
    ["posix", "/foo/bar", "/foo/bar/"],
])("normalizePath %s", (platform, input, expected) => {
    beforeAll(() => {
        window.api.normalizePath = (p) =>
            platform === "win32" ? p.replace(/\//g, "\\") + "\\" : p + "/";
    });
    it(`should normalize ${platform} path`, () => {
        expect(normalizePath(input)).toBe(expected);
    });
});

describe.each([
    ["win32", "C:\\foo\\bar", "baz", "C:\\foo\\bar\\baz"],
    ["posix", "/foo/bar", "baz", "/foo/bar/baz"],
])("mergePath %s", (platform, left, right, expected) => {
    beforeAll(() => {
        window.api.mergePath = (l, r = "") =>
            platform === "win32" ? l.replace(/\//g, "\\") + "\\" + r : l + "/" + r;
    });
    it(`should merge ${platform} path`, () => {
        expect(window.api.mergePath(left, right)).toBe(expected);
    });
});
