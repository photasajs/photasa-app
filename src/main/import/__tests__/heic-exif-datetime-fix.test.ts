import { describe, it, expect } from "vitest";

// 模拟HEICMetadataProcessor的extractDateTime方法
function extractDateTimeFixed(exifData: any): Date | null {
    if (!exifData) return null;

    const dateFields = ["DateTimeDigitized", "DateTimeOriginal", "DateTime"];
    for (const field of dateFields) {
        const dateTag = exifData[field];
        if (dateTag && dateTag.value && dateTag.value[0]) {
            try {
                // EXIF日期格式: "YYYY:MM:DD HH:mm:ss"
                // 只替换日期部分的冒号，保留时间部分
                const exifDateStr = dateTag.value[0];
                const dateStr = exifDateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
                const date = new Date(dateStr);

                // 验证 Date 对象是否有效
                if (isNaN(date.getTime())) {
                    continue; // 跳过无效的日期
                }

                return date;
            } catch (e) {
                continue;
            }
        }
    }
    return null;
}

describe("HEIC EXIF DateTime Fix Validation", () => {
    it("should correctly parse HEIC EXIF DateTime", () => {
        const mockExifData = {
            DateTimeOriginal: {
                value: ["2023:08:15 14:30:00"],
            },
            DateTime: {
                value: ["2023:08:15 16:45:30"],
            },
        };

        const extractedDate = extractDateTimeFixed(mockExifData);

        expect(extractedDate).not.toBeNull();
        expect((extractedDate as Date).getFullYear()).toBe(2023);
        expect((extractedDate as Date).getMonth()).toBe(7); // 月份从0开始
        expect((extractedDate as Date).getDate()).toBe(15);
        expect((extractedDate as Date).getHours()).toBe(14);
        expect((extractedDate as Date).getMinutes()).toBe(30);
        expect((extractedDate as Date).getSeconds()).toBe(0);
    });

    it("should prioritize DateTimeDigitized over other fields", () => {
        const mockExifData = {
            DateTimeDigitized: {
                value: ["2023:12:25 10:15:30"],
            },
            DateTimeOriginal: {
                value: ["2023:12:25 10:30:00"],
            },
            DateTime: {
                value: ["2023:12:25 11:00:00"],
            },
        };

        const extractedDate = extractDateTimeFixed(mockExifData);

        expect(extractedDate).not.toBeNull();
        expect((extractedDate as Date).getHours()).toBe(10);
        expect((extractedDate as Date).getMinutes()).toBe(15);
    });

    it("should handle invalid EXIF dates gracefully", () => {
        const mockExifData = {
            DateTimeOriginal: {
                value: ["2023:13:45 25:70:80"], // 无效的月日时分秒
            },
            DateTime: {
                value: ["2023:08:15 14:30:00"], // 有效的日期
            },
        };

        const extractedDate = extractDateTimeFixed(mockExifData);

        expect(extractedDate).not.toBeNull();
        expect((extractedDate as Date).getFullYear()).toBe(2023);
        expect((extractedDate as Date).getMonth()).toBe(7);
    });

    it("should return null when no valid dates found", () => {
        const mockExifData = {
            DateTimeOriginal: {
                value: ["invalid-date-string"],
            },
            DateTime: {
                value: ["2023:13:45 25:70:80"],
            },
        };

        const extractedDate = extractDateTimeFixed(mockExifData);

        expect(extractedDate).toBeNull();

        console.log(`✓ No valid dates found, returned null`);
    });

    it("should handle various valid EXIF date formats", () => {
        const testCases = [
            {
                exif: "2023:01:01 00:00:00",
                expected: new Date("2023-01-01 00:00:00"),
            },
            {
                exif: "2023:12:31 23:59:59",
                expected: new Date("2023-12-31 23:59:59"),
            },
            {
                exif: "2024:02:29 12:30:45", // 闰年
                expected: new Date("2024-02-29 12:30:45"),
            },
        ];

        for (const testCase of testCases) {
            const mockExifData = {
                DateTimeOriginal: {
                    value: [testCase.exif],
                },
            };

            const extractedDate = extractDateTimeFixed(mockExifData);

            expect(extractedDate).not.toBeNull();
            expect((extractedDate as Date).getTime()).toBe(testCase.expected.getTime());
        }
    });

    it("should handle empty or missing EXIF data", () => {
        const testCases = [
            null,
            undefined,
            {},
            { DateTimeOriginal: null },
            { DateTimeOriginal: { value: null } },
            { DateTimeOriginal: { value: [] } },
        ];

        for (const testCase of testCases) {
            const extractedDate = extractDateTimeFixed(testCase);
            expect(extractedDate).toBeNull();
        }
    });
});
