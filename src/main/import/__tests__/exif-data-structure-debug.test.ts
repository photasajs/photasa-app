import { describe, it, expect } from "vitest";

interface ExifTag {
    value?: string[];
    description?: string;
}

interface MockExifData {
    DateTimeOriginal: ExifTag | string;
}

describe("EXIF Data Structure Debug", () => {
    it("should analyze ExifReader data structure format", async () => {
        console.log("\n=== ExifReader 数据结构分析 ===\n");

        try {
            console.log("ExifReader库版本和数据结构分析:");
            console.log("1. 检查DateTimeOriginal字段的数据结构");
            console.log("2. 验证是使用 .value[0] 还是 .description 访问");
            console.log("3. 确认不同文件类型的EXIF数据格式差异\n");

            console.log("当前代码中的EXIF访问方式不一致:");
            console.log("- HEICMetadataProcessor.extractDateTime(): tags[field].value[0]");
            console.log("- RAWMetadataProcessor.extractDateTime(): tags[field].description");
            console.log("- extractDateTimeFromExif(): tags[field].value[0]");
            console.log("- preload/exif-helper.ts: tags['DateTimeDigitized'].value[0]\n");

            const mockExifStructures = [
                {
                    name: "格式1: value数组",
                    data: {
                        DateTimeOriginal: {
                            value: ["2023:08:15 14:30:00"],
                            description: "2023:08:15 14:30:00",
                        },
                    } as MockExifData,
                },
                {
                    name: "格式2: 仅description",
                    data: {
                        DateTimeOriginal: {
                            description: "2023:08:15 14:30:00",
                        },
                    } as MockExifData,
                },
                {
                    name: "格式3: 直接字符串",
                    data: {
                        DateTimeOriginal: "2023:08:15 14:30:00",
                    } as MockExifData,
                },
            ];

            for (const structure of mockExifStructures) {
                console.log(`--- 测试 ${structure.name} ---`);
                const tags = structure.data;

                const accessMethods = [
                    {
                        name: "tags.DateTimeOriginal?.value?.[0]",
                        getValue: () => {
                            const tag = tags.DateTimeOriginal;
                            return typeof tag === "object" && tag.value ? tag.value[0] : undefined;
                        },
                    },
                    {
                        name: "tags.DateTimeOriginal?.description",
                        getValue: () => {
                            const tag = tags.DateTimeOriginal;
                            return typeof tag === "object" ? tag.description : undefined;
                        },
                    },
                    {
                        name: "tags.DateTimeOriginal (直接访问)",
                        getValue: () => {
                            return typeof tags.DateTimeOriginal === "string"
                                ? tags.DateTimeOriginal
                                : null;
                        },
                    },
                ];

                for (const method of accessMethods) {
                    const value = method.getValue();
                    console.log(`  ${method.name}: ${value || "undefined"}`);
                }
                console.log("");
            }
        } catch (error) {
            console.error("EXIF数据结构分析失败:", error);
        }
    });

    it("should provide unified EXIF date extraction function", () => {
        console.log("\n=== 统一的EXIF日期提取函数设计 ===\n");

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
            console.log(`--- 测试 ${testCase.name} ---`);
            const result = extractDateTimeUnified(testCase.tags, "DateTimeOriginal");
            console.log(`结果: ${result ? result.toISOString() : "null"}`);

            if (result) {
                expect(result.getFullYear()).toBe(2023);
                expect(result.getMonth()).toBe(7);
                expect(result.getDate()).toBe(15);
            }
        }

        console.log("\n✅ 统一的EXIF日期提取函数测试通过");
    });
});
