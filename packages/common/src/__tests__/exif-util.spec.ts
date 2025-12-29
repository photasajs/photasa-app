import { describe, it, expect } from "vitest";
import {
    extractDateStringFromTag,
    extractTimezoneOffset,
    normalizeExifDateString,
    extractDateTimeFromExifField,
    extractDateTimeFromExif,
} from "../exif-util";

describe("exif-util", () => {
    describe("extractDateStringFromTag", () => {
        it("should return null for empty tag", () => {
            expect(extractDateStringFromTag(null)).toBeNull();
            expect(extractDateStringFromTag(undefined)).toBeNull();
        });

        it("should return string as is", () => {
            expect(extractDateStringFromTag("2023:01:01 12:00:00")).toBe("2023:01:01 12:00:00");
        });

        it("should extract from value array", () => {
            expect(extractDateStringFromTag({ value: ["2023:01:01"] })).toBe("2023:01:01");
        });

        it("should extract from description", () => {
            expect(extractDateStringFromTag({ description: "2023:01:01" })).toBe("2023:01:01");
        });

        it("should return null if no valid value", () => {
            expect(extractDateStringFromTag({})).toBeNull();
            expect(extractDateStringFromTag({ value: [] })).toBeNull();
        });
    });

    describe("extractTimezoneOffset", () => {
        // Alias for extractDateStringFromTag, just simple check
        it("should extract offset string", () => {
            expect(extractTimezoneOffset("+08:00")).toBe("+08:00");
        });
    });

    describe("normalizeExifDateString", () => {
        it("should replace colons with dashes for date part", () => {
            expect(normalizeExifDateString("2023:01:01 12:00:00")).toBe("2023-01-01 12:00:00");
        });

        it("should keep string as is if not matching pattern", () => {
            expect(normalizeExifDateString("invalid")).toBe("invalid");
        });
    });

    describe("extractDateTimeFromExifField", () => {
        it("should return date object for valid field", () => {
            const tags = { DateTimeOriginal: "2023:01:01 12:00:00" };
            const date = extractDateTimeFromExifField(tags, "DateTimeOriginal");
            expect(date).toBeInstanceOf(Date);
            // Check components to avoid timezone issues ensuring it parsed correctly as local time
            expect(date?.getFullYear()).toBe(2023);
            expect(date?.getMonth()).toBe(0); // 0-indexed
            expect(date?.getDate()).toBe(1);
            expect(date?.getHours()).toBe(12);
            expect(date?.getMinutes()).toBe(0);
            expect(date?.getSeconds()).toBe(0);
        });

        it("should handle timezone offset", () => {
            const tags = {
                DateTimeOriginal: "2023:01:01 12:00:00",
                OffsetTime: "+08:00",
            };
            const date = extractDateTimeFromExifField(tags, "DateTimeOriginal");
            // "2023-01-01 12:00:00+08:00" -> This is an absolute time.
            // 12:00:00 in +08:00 is 04:00:00 UTC.
            expect(date).not.toBeNull();
            expect(date!.toISOString()).toBe("2023-01-01T04:00:00.000Z");
        });

        it("should return null for invalid date", () => {
            const tags = { DateTimeOriginal: "invalid" };
            const date = extractDateTimeFromExifField(tags, "DateTimeOriginal");
            expect(date).toBeNull();
        });

        it("should return null for missing field", () => {
            const tags = {};
            const date = extractDateTimeFromExifField(tags, "DateTimeOriginal");
            expect(date).toBeNull();
        });
    });

    describe("extractDateTimeFromExif", () => {
        it("should try fields in order", () => {
            const tags = {
                DateTime: "2024:01:01 00:00:00", // 3rd priority
                DateTimeOriginal: "2023:01:01 00:00:00", // 2nd priority
                DateTimeDigitized: "2022:01:01 00:00:00", // 1st priority
            };
            // Default order: Digitized, Original, DateTime
            const date = extractDateTimeFromExif(tags);
            expect(date?.getFullYear()).toBe(2022);
        });

        it("should return null if no fields present", () => {
            expect(extractDateTimeFromExif({})).toBeNull();
        });

        it("should return null if tags is null/undefined", () => {
            expect(extractDateTimeFromExif(null as any)).toBeNull();
            expect(extractDateTimeFromExif(undefined as any)).toBeNull();
        });
    });
});
