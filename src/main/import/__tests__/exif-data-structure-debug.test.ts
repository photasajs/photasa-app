import { describe, it, expect } from "vitest";

interface ExifTag {
    value?: string[];
    description?: string;
}

interface MockExifData {
    DateTimeOriginal: ExifTag | string;
}

describe("EXIF Data Structure Debug", () => {
    it("should handle different ExifReader data structure formats", () => {
        const mockExifStructures = [
            {
                name: "value数组格式",
                data: {
                    DateTimeOriginal: {
                        value: ["2023:08:15 14:30:00"],
                        description: "2023:08:15 14:30:00",
                    },
                } as MockExifData,
            },
            {
                name: "仅description格式",
                data: {
                    DateTimeOriginal: {
                        description: "2023:08:15 14:30:00",
                    },
                } as MockExifData,
            },
            {
                name: "直接字符串格式",
                data: {
                    DateTimeOriginal: "2023:08:15 14:30:00",
                } as MockExifData,
            },
        ];

        for (const structure of mockExifStructures) {
            const tags = structure.data;

            const accessMethods = [
                {
                    name: "value数组访问",
                    getValue: () => {
                        const tag = tags.DateTimeOriginal;
                        return typeof tag === "object" && tag.value ? tag.value[0] : undefined;
                    },
                },
                {
                    name: "description访问",
                    getValue: () => {
                        const tag = tags.DateTimeOriginal;
                        return typeof tag === "object" ? tag.description : undefined;
                    },
                },
                {
                    name: "直接字符串访问",
                    getValue: () => {
                        return typeof tags.DateTimeOriginal === "string"
                            ? tags.DateTimeOriginal
                            : null;
                    },
                },
            ];

            // 验证至少有一种访问方式能正确获取到值
            const validValues = accessMethods
                .map((method) => method.getValue())
                .filter((value) => value !== undefined && value !== null);

            expect(validValues.length).toBeGreaterThan(0);
            expect(validValues[0]).toBe("2023:08:15 14:30:00");
        }
    });

    it("should provide unified EXIF date extraction function", () => {
        function extractDateTimeUnified(tags: any, field: string): Date | null {
            if (!tags || !tags[field]) {
                return null;
            }

            const dateTag = tags[field];
            let dateStr: string | null = null;

            if (dateTag.value && Array.isArray(dateTag.value) && dateTag.value[0]) {
                dateStr = dateTag.value[0];
            } else if (dateTag.description) {
                dateStr = dateTag.description;
            } else if (typeof dateTag === "string") {
                dateStr = dateTag;
            }

            if (!dateStr) {
                return null;
            }

            try {
                const normalizedDateStr = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
                const date = new Date(normalizedDateStr);

                if (isNaN(date.getTime())) {
                    return null;
                }

                return date;
            } catch (error) {
                return null;
            }
        }

        const testCases = [
            {
                name: "value数组格式",
                tags: {
                    DateTimeOriginal: {
                        value: ["2023:08:15 14:30:00"],
                        description: "2023:08:15 14:30:00",
                    },
                },
            },
            {
                name: "仅description格式",
                tags: {
                    DateTimeOriginal: {
                        description: "2023:08:15 14:30:00",
                    },
                },
            },
            {
                name: "直接字符串格式",
                tags: {
                    DateTimeOriginal: "2023:08:15 14:30:00",
                },
            },
        ];

        for (const testCase of testCases) {
            const result = extractDateTimeUnified(testCase.tags, "DateTimeOriginal");

            // 验证函数能正确提取日期
            expect(result).not.toBeNull();
            if (result) {
                expect(result.getFullYear()).toBe(2023);
                expect(result.getMonth()).toBe(7); // 月份从0开始，8月是7
                expect(result.getDate()).toBe(15);
            }
        }
    });
});
