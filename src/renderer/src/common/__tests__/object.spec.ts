import { describe, it, expect } from "vitest";
import { notEmpty, empty } from "./object";

describe("notEmpty", () => {
    it("should return false for null/undefined", () => {
        expect(notEmpty(null)).toBe(false);
        expect(notEmpty(undefined)).toBe(false);
    });
    it("should return false for empty string", () => {
        expect(notEmpty("")).toBe(false);
    });
    it("should return true for non-empty string", () => {
        expect(notEmpty("abc")).toBe(true);
    });
    it("should return false for 0", () => {
        expect(notEmpty(0)).toBe(false);
    });
    it("should return true for non-zero number", () => {
        expect(notEmpty(123)).toBe(true);
    });
    it("should return true for boolean", () => {
        expect(notEmpty(true)).toBe(true);
        expect(notEmpty(false)).toBe(true);
    });
    it("should return false for empty object", () => {
        expect(notEmpty({})).toBe(false);
    });
    it("should return true for non-empty object", () => {
        expect(notEmpty({ a: 1 })).toBe(true);
    });
    it("should return false for empty array", () => {
        expect(notEmpty([])).toBe(false);
    });
    it("should return true for non-empty array", () => {
        expect(notEmpty([1, 2, 3])).toBe(true);
    });
});

describe("empty", () => {
    it("should return true for null/undefined/empty", () => {
        expect(empty(null)).toBe(true);
        expect(empty(undefined)).toBe(true);
        expect(empty("")).toBe(true);
        expect(empty(0)).toBe(true);
        expect(empty([])).toBe(true);
        expect(empty({})).toBe(true);
    });
    it("should return false for non-empty values", () => {
        expect(empty("abc")).toBe(false);
        expect(empty(123)).toBe(false);
        expect(empty(true)).toBe(false);
        expect(empty({ a: 1 })).toBe(false);
        expect(empty([1])).toBe(false);
    });
});
