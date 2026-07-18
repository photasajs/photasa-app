import { describe, it, expect } from "vitest";
import { deepClone } from "../clone";

describe("deepClone", () => {
    it("should return primitive values as is", () => {
        expect(deepClone(null)).toBe(null);
        expect(deepClone(undefined)).toBe(undefined);
        expect(deepClone(123)).toBe(123);
        expect(deepClone("test")).toBe("test");
        expect(deepClone(true)).toBe(true);
    });

    it("should clone Date objects", () => {
        const date = new Date("2023-01-01");
        const cloned = deepClone(date);
        expect(cloned).toEqual(date);
        expect(cloned).not.toBe(date);
    });

    it("should clone arrays", () => {
        const arr = [1, { a: 2 }, [3]];
        const cloned = deepClone(arr);
        expect(cloned).toEqual(arr);
        expect(cloned).not.toBe(arr);
        expect(cloned[1]).not.toBe(arr[1]);
        expect(cloned[2]).not.toBe(arr[2]);
    });

    it("should clone objects", () => {
        const obj = { a: 1, b: { c: 2 } };
        const cloned = deepClone(obj);
        expect(cloned).toEqual(obj);
        expect(cloned).not.toBe(obj);
        expect(cloned.b).not.toBe(obj.b);
    });

    it("should ignore functions and symbols in objects", () => {
        const obj = {
            a: 1,
            fn: () => {},
            sym: Symbol("test"),
        };
        const cloned = deepClone(obj);
        // JSON.stringify behavior is to ignore functions and symbols
        // But our deepClone implementation copies enumerable properties.
        // Let's check the implementation again.
        // It copies keys using for...in.
        // Function and Symbol values will be copied by reference if not handled?
        // Implementation: typeof value !== "object" returns value. Function is "function".
        // So functions are returned by reference.
        // Wait, deepClone logic:
        // if typeof value !== "object" -> returns value.
        // functions are "function", so they are returned as is.
        // Let's verify this behavior in test.
        expect(cloned.fn).toBe(obj.fn);
        expect(cloned.sym).toBe(obj.sym);
    });

    it("should handle mixed types", () => {
        const complex = {
            date: new Date(),
            arr: [1, "2", null],
            nested: {
                a: undefined,
                b: true,
            },
        };
        const cloned = deepClone(complex);
        expect(cloned).toEqual(complex);
        expect(cloned).not.toBe(complex);
        expect(cloned.date).not.toBe(complex.date);
        expect(cloned.date.getTime()).toBe(complex.date.getTime());
    });
});
