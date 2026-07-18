import { describe, it, expect } from "vitest";
import { selectBestDate } from "@photasa/maliang";

// Video time field priorities for testing
const VIDEO_TIME_FIELDS = ["com.apple.quicktime.creationdate", "creation_time", "date"];

describe("Video Time Extraction", () => {
    describe("selectBestDate field priority", () => {
        it("should prioritize com.apple.quicktime.creationdate over creation_time", () => {
            const metadata = {
                format: {
                    tags: {
                        creation_time: "2023-01-01T10:00:00.000000Z",
                        "com.apple.quicktime.creationdate": "2023-01-01T12:30:45-0700",
                    },
                },
                streams: [],
            };

            const result = selectBestDate(metadata, VIDEO_TIME_FIELDS);
            expect(result).toBeInstanceOf(Date);

            // Should use the quicktime creationdate (12:30:45-0700), not creation_time (10:00:00Z)
            const expectedDate = new Date("2023-01-01T12:30:45-0700");
            expect(result?.getTime()).toBe(expectedDate.getTime());
        });

        it("should fall back to creation_time when quicktime.creationdate is missing", () => {
            const metadata = {
                format: {
                    tags: {
                        creation_time: "2023-01-01T10:00:00.000000Z",
                    },
                },
                streams: [],
            };

            const result = selectBestDate(metadata, VIDEO_TIME_FIELDS);
            expect(result).toBeInstanceOf(Date);

            const expectedDate = new Date("2023-01-01T10:00:00.000000Z");
            expect(result?.getTime()).toBe(expectedDate.getTime());
        });

        it("should fall back to date field when both quicktime and creation_time are missing", () => {
            const metadata = {
                format: {
                    tags: {
                        date: "2023-01-01T15:45:30.000000Z",
                    },
                },
                streams: [],
            };

            const result = selectBestDate(metadata, VIDEO_TIME_FIELDS);
            expect(result).toBeInstanceOf(Date);

            const expectedDate = new Date("2023-01-01T15:45:30.000000Z");
            expect(result?.getTime()).toBe(expectedDate.getTime());
        });

        it("should check stream-level tags when format-level tags are missing", () => {
            const metadata = {
                format: { tags: {} },
                streams: [
                    {
                        tags: {
                            "com.apple.quicktime.creationdate": "2023-01-01T14:20:15-0800",
                        },
                    },
                ],
            };

            const result = selectBestDate(metadata, VIDEO_TIME_FIELDS);
            expect(result).toBeInstanceOf(Date);

            const expectedDate = new Date("2023-01-01T14:20:15-0800");
            expect(result?.getTime()).toBe(expectedDate.getTime());
        });

        it("should skip invalid dates and continue to next field", () => {
            const metadata = {
                format: {
                    tags: {
                        "com.apple.quicktime.creationdate": "invalid-date",
                        creation_time: "2023-01-01T10:00:00.000000Z",
                    },
                },
                streams: [],
            };

            const result = selectBestDate(metadata, VIDEO_TIME_FIELDS);
            expect(result).toBeInstanceOf(Date);

            // Should skip invalid quicktime date and use creation_time
            const expectedDate = new Date("2023-01-01T10:00:00.000000Z");
            expect(result?.getTime()).toBe(expectedDate.getTime());
        });

        it("should skip zero dates and continue to next field", () => {
            const metadata = {
                format: {
                    tags: {
                        "com.apple.quicktime.creationdate": "0000-00-00T00:00:00.000000Z",
                        creation_time: "2023-01-01T10:00:00.000000Z",
                    },
                },
                streams: [],
            };

            const result = selectBestDate(metadata, VIDEO_TIME_FIELDS);
            expect(result).toBeInstanceOf(Date);

            // Should skip zero date and use creation_time
            const expectedDate = new Date("2023-01-01T10:00:00.000000Z");
            expect(result?.getTime()).toBe(expectedDate.getTime());
        });

        it("should return null when no valid time fields are found", () => {
            const metadata = {
                format: { tags: {} },
                streams: [{ tags: {} }],
            };

            const result = selectBestDate(metadata, VIDEO_TIME_FIELDS);
            expect(result).toBeNull();
        });

        it("should handle timezone information correctly", () => {
            const metadata = {
                format: {
                    tags: {
                        "com.apple.quicktime.creationdate": "2023-07-01T13:42:23-0700", // PDT
                    },
                },
                streams: [],
            };

            const result = selectBestDate(metadata, VIDEO_TIME_FIELDS);
            expect(result).toBeInstanceOf(Date);

            // Verify the timezone is properly handled
            const expectedDate = new Date("2023-07-01T13:42:23-0700");
            expect(result?.getTime()).toBe(expectedDate.getTime());

            // Verify it's different from UTC interpretation
            const utcDate = new Date("2023-07-01T13:42:23Z");
            expect(result?.getTime()).not.toBe(utcDate.getTime());
        });
    });
});
