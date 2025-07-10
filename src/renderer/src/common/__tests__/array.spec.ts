import { describe, it, expect } from "vitest";
import { isArray } from "./array";

describe("isArray", () => {
    it("should return true for arrays", () => {
        expect(isArray([])).toBe(true);
        expect(isArray([1, 2, 3])).toBe(true);
        expect(isArray([])).toBe(true);
    });

    it("should return false for non-arrays", () => {
        expect(isArray(undefined)).toBe(false);
        expect(isArray(null)).toBe(false);
        expect(isArray({})).toBe(false);
        expect(isArray("string")).toBe(false);
        expect(isArray(123)).toBe(false);
        expect(isArray(true)).toBe(false);
        expect(isArray(() => [])).toBe(false);
    });
});
