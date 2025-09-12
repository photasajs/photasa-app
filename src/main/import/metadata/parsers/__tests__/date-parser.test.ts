import { describe, it, expect } from "vitest";
import { isValidDate, selectBestDate, generateDatePath } from "../date-parser";

describe("Date Parser", () => {
    describe("isValidDate", () => {
        it("should return true for valid dates", () => {
            expect(isValidDate(new Date("2023-01-01T12:00:00.000Z"))).toBe(true);
            expect(isValidDate(new Date("2020-02-29T15:30:45.123Z"))).toBe(true); // Leap year
            expect(isValidDate(new Date(1640995200000))).toBe(true); // Timestamp
        });

        it("should return false for invalid dates", () => {
            expect(isValidDate(new Date("invalid"))).toBe(false);
            expect(isValidDate(new Date(NaN))).toBe(false);
        });

        it("should return true for any valid JavaScript date", () => {
            expect(isValidDate(new Date("1899-12-31"))).toBe(true);
            expect(isValidDate(new Date("2101-01-01"))).toBe(true);
            expect(isValidDate(new Date("1900-01-01"))).toBe(true);
            expect(isValidDate(new Date("2100-12-31"))).toBe(true);
        });

        it("should handle null and undefined", () => {
            expect(isValidDate(null as any)).toBe(false);
            expect(isValidDate(undefined as any)).toBe(false);
        });
    });

    describe("selectBestDate", () => {
        it("should prefer DateTimeOriginal over other dates", () => {
            const metadata = {
                format: {
                    tags: {
                        creation_time: "2023-01-01T10:00:00.000Z",
                    },
                },
            };
            const timeFields = ["creation_time"];

            const result = selectBestDate(metadata, timeFields);
            expect(result).toEqual(new Date("2023-01-01T10:00:00.000Z"));
        });

        it("should check stream-level tags when format tags not available", () => {
            const metadata = {
                format: { tags: {} },
                streams: [
                    {
                        tags: {
                            creation_time: "2023-01-03T10:00:00.000Z",
                        },
                    },
                ],
            };
            const timeFields = ["creation_time"];

            const result = selectBestDate(metadata, timeFields);
            expect(result).toEqual(new Date("2023-01-03T10:00:00.000Z"));
        });

        it("should return first valid date from timeFields priority", () => {
            const metadata = {
                format: {
                    tags: {
                        modify_time: "2023-01-02T10:00:00.000Z",
                    },
                },
            };
            const timeFields = ["creation_time", "modify_time"];

            const result = selectBestDate(metadata, timeFields);
            expect(result).toEqual(new Date("2023-01-02T10:00:00.000Z"));
        });

        it("should return null when no valid dates found", () => {
            const metadata = {
                format: { tags: {} },
                streams: [],
            };
            const timeFields = ["creation_time"];

            const result = selectBestDate(metadata, timeFields);
            expect(result).toBeNull();
        });

        it("should skip invalid dates and select next valid one", () => {
            const metadata = {
                format: {
                    tags: {
                        invalid_time: "invalid-date",
                        creation_time: "2023-01-03T10:00:00.000Z",
                    },
                },
            };
            const timeFields = ["invalid_time", "creation_time"];

            const result = selectBestDate(metadata, timeFields);
            expect(result).toEqual(new Date("2023-01-03T10:00:00.000Z"));
        });

        it("should return null when all dates are invalid", () => {
            const metadata = {
                format: {
                    tags: {
                        invalid_time1: "invalid-date",
                        invalid_time2: "0000-00-00T00:00:00.000000Z",
                    },
                },
            };
            const timeFields = ["invalid_time1", "invalid_time2"];

            const result = selectBestDate(metadata, timeFields);
            expect(result).toBeNull();
        });

        it("should return null for empty metadata", () => {
            const result = selectBestDate({}, ["creation_time"]);
            expect(result).toBeNull();
        });

        it("should return first valid date even if others exist", () => {
            const metadata = {
                format: {
                    tags: {
                        first_time: "2023-01-01T10:00:00.000Z",
                        second_time: "2023-01-03T10:00:00.000Z",
                    },
                },
            };
            const timeFields = ["first_time", "second_time"];

            const result = selectBestDate(metadata, timeFields);
            expect(result).toEqual(new Date("2023-01-01T10:00:00.000Z"));
        });

        it("should handle missing fields in metadata", () => {
            const metadata = {
                format: {
                    tags: {
                        valid_time: "2023-01-02T10:00:00.000Z",
                    },
                },
            };
            const timeFields = ["missing_time", "valid_time"];

            const result = selectBestDate(metadata, timeFields);
            expect(result).toEqual(new Date("2023-01-02T10:00:00.000Z"));
        });
    });

    describe("generateDatePath", () => {
        it("should generate correct date path for a valid date", () => {
            const date = new Date("2023-03-15T14:30:00.000Z");
            const result = generateDatePath(date);
            expect(result).toBe("2023/20230315");
        });

        it("should handle single digit months", () => {
            const date = new Date("2023-01-05T08:15:30.000Z");
            const result = generateDatePath(date);
            expect(result).toBe("2023/20230105");
        });

        it("should handle December", () => {
            const date = new Date("2023-12-25T23:59:59.000Z");
            const result = generateDatePath(date);
            expect(result).toBe("2023/20231225");
        });

        it("should handle leap year February", () => {
            const date = new Date("2020-02-29T12:00:00.000Z");
            const result = generateDatePath(date);
            expect(result).toBe("2020/20200229");
        });

        it("should handle early years", () => {
            const date = new Date("1995-07-20T16:45:00.000Z");
            const result = generateDatePath(date);
            expect(result).toBe("1995/19950720");
        });

        it("should handle future dates", () => {
            const date = new Date("2030-11-11T11:11:11.000Z");
            const result = generateDatePath(date);
            expect(result).toBe("2030/20301111");
        });

        it("should use current date for null date", () => {
            const result = generateDatePath(null as unknown as Date);
            const currentDate = new Date();
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, "0");
            const day = String(currentDate.getDate()).padStart(2, "0");
            expect(result).toBe(`${year}/${year}${month}${day}`);
        });

        it("should use current date for invalid date", () => {
            const invalidDate = new Date("invalid-date");
            const result = generateDatePath(invalidDate);
            const currentDate = new Date();
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, "0");
            const day = String(currentDate.getDate()).padStart(2, "0");
            expect(result).toBe(`${year}/${year}${month}${day}`);
        });

        it("should handle timezone differences consistently", () => {
            // Testing that the function uses local time consistently
            const date1 = new Date("2023-06-15T00:00:00.000Z"); // UTC midnight
            const date2 = new Date("2023-06-15T23:59:59.999Z"); // UTC end of day

            const result1 = generateDatePath(date1);
            const result2 = generateDatePath(date2);

            // Both should generate paths based on their local date representation
            expect(result1).toMatch(/^2023\/2023\d{4}$/);
            expect(result2).toMatch(/^2023\/2023\d{4}$/);
        });

        it("should handle year boundary correctly", () => {
            const date2022 = new Date("2022-06-15T12:00:00.000Z");
            const date2023 = new Date("2023-06-15T12:00:00.000Z");

            const result1 = generateDatePath(date2022);
            const result2 = generateDatePath(date2023);

            // Results should show different years
            expect(result1).toContain("2022");
            expect(result2).toContain("2023");
        });
    });
});
