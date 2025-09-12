import { describe, it, expect, vi } from "vitest";
import { computeFallbackDate } from "../metadata/parsers/date-parser";

describe("Compute Fallback Date Logic", () => {
    it("should choose the earlier date when both createdTime and modifiedTime are valid", () => {
        const createdTime = new Date("2023-08-15T10:00:00.000Z");
        const modifiedTime = new Date("2023-08-16T14:30:00.000Z");

        const result = computeFallbackDate(createdTime, modifiedTime);

        // Should choose createdTime (earlier)
        expect(result.date).toEqual(createdTime);
        expect(result.source).toBe("file_created");
    });

    it("should choose modifiedTime when it's earlier than createdTime", () => {
        const createdTime = new Date("2023-08-16T14:30:00.000Z");
        const modifiedTime = new Date("2023-08-15T10:00:00.000Z");

        const result = computeFallbackDate(createdTime, modifiedTime);

        // Should choose modifiedTime (earlier)
        expect(result.date).toEqual(modifiedTime);
        expect(result.source).toBe("file_modified");
    });

    it("should use createdTime when only it's valid", () => {
        const createdTime = new Date("2023-08-15T10:00:00.000Z");
        const modifiedTime = new Date("invalid-date");

        const result = computeFallbackDate(createdTime, modifiedTime);

        expect(result.date).toEqual(createdTime);
        expect(result.source).toBe("file_created");
    });

    it("should use modifiedTime when only it's valid", () => {
        const createdTime = new Date("invalid-date");
        const modifiedTime = new Date("2023-08-15T10:00:00.000Z");

        const result = computeFallbackDate(createdTime, modifiedTime);

        expect(result.date).toEqual(modifiedTime);
        expect(result.source).toBe("file_modified");
    });

    it("should use current date when both dates are invalid", () => {
        const createdTime = new Date("invalid-date");
        const modifiedTime = new Date("invalid-date");

        const result = computeFallbackDate(createdTime, modifiedTime);

        expect(result.date).toBeInstanceOf(Date);
        expect(result.source).toBe("current_date");
        expect(result.date.getTime()).toBeGreaterThan(Date.now() - 1000); // Within 1 second
    });

    it("should handle undefined dates gracefully", () => {
        const result = computeFallbackDate(undefined, undefined);

        expect(result.date).toBeInstanceOf(Date);
        expect(result.source).toBe("current_date");
        expect(result.date.getTime()).toBeGreaterThan(Date.now() - 1000); // Within 1 second
    });

    it("should handle mixed valid/invalid dates", () => {
        const createdTime = undefined;
        const modifiedTime = new Date("2023-08-15T10:00:00.000Z");

        const result = computeFallbackDate(createdTime, modifiedTime);

        expect(result.date).toEqual(modifiedTime);
        expect(result.source).toBe("file_modified");
    });

    it("should log debug information when choosing between two valid dates", () => {
        const mockLogger = {
            debug: vi.fn(),
            warn: vi.fn(),
        };

        const createdTime = new Date("2023-08-15T10:00:00.000Z");
        const modifiedTime = new Date("2023-08-16T14:30:00.000Z");

        computeFallbackDate(createdTime, modifiedTime, mockLogger);

        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining("Using file creation time (earlier)"),
        );
    });

    it("should log debug information when using single valid date", () => {
        const mockLogger = {
            debug: vi.fn(),
            warn: vi.fn(),
        };

        const createdTime = new Date("2023-08-15T10:00:00.000Z");
        const modifiedTime = undefined;

        computeFallbackDate(createdTime, modifiedTime, mockLogger);

        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining("Using file creation time"),
        );
    });

    it("should log warning when using current date fallback", () => {
        const mockLogger = {
            debug: vi.fn(),
            warn: vi.fn(),
        };

        const createdTime = new Date("invalid-date");
        const modifiedTime = new Date("invalid-date");

        computeFallbackDate(createdTime, modifiedTime, mockLogger);

        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining("No valid file dates found, using current date as fallback"),
        );
    });
});
