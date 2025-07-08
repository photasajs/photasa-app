import { describe, it, expect } from "vitest";
import { isString } from "./string";

describe("isString", () => {
    it("returns true for strings", () => {
        expect(isString("")).toBe(true);
        expect(isString("abc")).toBe(true);
        expect(isString(String(123))).toBe(true);
    });

    it("returns false for non-strings", () => {
        expect(isString(undefined)).toBe(false);
        expect(isString(null)).toBe(false);
        expect(isString(123)).toBe(false);
        expect(isString({})).toBe(false);
        expect(isString([])).toBe(false);
        expect(isString(true)).toBe(false);
        expect(isString(() => "a")).toBe(false);
    });
});
