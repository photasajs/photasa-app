import { normalizePath } from "../path";
import { describe, it, expect } from "vitest";

describe("normalizePath", () => {
    it("should append a slash to the end of the path", () => {
        const path = "/Users/albert.li/Desktop";
        expect(normalizePath(path)).toBe("/Users/albert.li/Desktop/");
    });
});
