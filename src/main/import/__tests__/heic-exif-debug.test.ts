import { describe, it, expect } from "vitest";

describe("HEIC EXIF Date Format Debug", () => {
    it("should debug EXIF date string format conversion", () => {
        // 模拟EXIF日期格式: "YYYY:MM:DD HH:mm:ss"
        const exifDateString = "2023:08:15 14:30:00";

        // 正确的转换逻辑：只替换日期部分的冒号，保留时间部分
        const convertedDate2 = exifDateString.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");

        // 测试日期对象创建
        const date2 = new Date(convertedDate2);

        // 验证正确的格式能创建有效日期
        expect(isNaN(date2.getTime())).toBe(false);
        expect(date2.getFullYear()).toBe(2023);
        expect(date2.getMonth()).toBe(7); // 月份是从0开始的
        expect(date2.getDate()).toBe(15);
        expect(date2.getHours()).toBe(14);
        expect(date2.getMinutes()).toBe(30);
    });

    it("should test various EXIF date formats", () => {
        const testCases = [
            "2023:08:15 14:30:00",
            "2023:12:31 23:59:59",
            "2020:01:01 00:00:00",
            "2024:02:29 12:00:00", // 闰年
        ];

        for (const exifDate of testCases) {
            // 当前的错误方式
            const _wrongConversion = exifDate.replace(/:/, "-").replace(/:/, "-");
            const _wrongDate = new Date(_wrongConversion);
            void _wrongDate; // 明确忽略未使用的变量

            // 正确的方式
            const correctConversion = exifDate.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
            const correctDate = new Date(correctConversion);

            expect(isNaN(correctDate.getTime())).toBe(false);
        }
    });
});
