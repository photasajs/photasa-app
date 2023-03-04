import { normalizePath } from "../path";

describe("normalizePath", () => {
    it("should append a slash to the end of the path", () => {
        const path = "/Users/albert.li/Desktop";
        expect(normalizePath(path)).toBe("/Users/albert.li/Desktop/");
    });
});
