import { describe, it, expect } from "vitest";
import { safeNumber, safePositiveNumber } from "../number";

describe("number utilities", () => {
    describe("safeNumber", () => {
        it("应该直接返回数字类型的值", () => {
            expect(safeNumber(42)).toBe(42);
            expect(safeNumber(0)).toBe(0);
            expect(safeNumber(-10)).toBe(-10);
            expect(safeNumber(3.14)).toBe(3.14);
        });

        it("应该将有效的数字字符串转换为数字", () => {
            expect(safeNumber("42")).toBe(42);
            expect(safeNumber("0")).toBe(0);
            expect(safeNumber("-10")).toBe(-10);
            expect(safeNumber("123")).toBe(123);
        });

        it("应该使用parseInt解析字符串", () => {
            expect(safeNumber("42.99")).toBe(42); // parseInt truncates
            expect(safeNumber("123abc")).toBe(123); // parseInt stops at first non-digit
            expect(safeNumber("  456  ")).toBe(456); // parseInt handles whitespace
        });

        it("应该在无法转换时返回默认值", () => {
            expect(safeNumber("abc")).toBe(0);
            expect(safeNumber("")).toBe(0);
            expect(safeNumber("not-a-number")).toBe(0);
            expect(safeNumber("NaN")).toBe(0);
        });

        it("应该使用自定义默认值", () => {
            expect(safeNumber("abc", 100)).toBe(100);
            expect(safeNumber("", -1)).toBe(-1);
            expect(safeNumber("invalid", 999)).toBe(999);
        });

        it("应该处理其他类型为默认值", () => {
            expect(safeNumber(null as any)).toBe(0);
            expect(safeNumber(undefined as any)).toBe(0);
            expect(safeNumber({} as any)).toBe(0);
            expect(safeNumber([] as any)).toBe(0);
            expect(safeNumber(true as any)).toBe(0);
            expect(safeNumber(false as any)).toBe(0);
        });

        it("应该处理特殊数字值", () => {
            expect(safeNumber(Infinity)).toBe(Infinity);
            expect(safeNumber(-Infinity)).toBe(-Infinity);
            expect(safeNumber(NaN, 42)).toBe(NaN); // NaN is a number type, returned as-is
        });

        it("应该处理二进制和十六进制字符串", () => {
            expect(safeNumber("0x10")).toBe(0); // parseInt with base 10 doesn't parse hex
            expect(safeNumber("0b1010")).toBe(0); // parseInt with base 10 doesn't parse binary
        });
    });

    describe("safePositiveNumber", () => {
        it("应该返回正数", () => {
            expect(safePositiveNumber(42)).toBe(42);
            expect(safePositiveNumber(1)).toBe(1);
            expect(safePositiveNumber(3.14)).toBe(3.14); // 数字类型直接返回
        });

        it("应该处理正数字符串", () => {
            expect(safePositiveNumber("42")).toBe(42);
            expect(safePositiveNumber("123")).toBe(123);
            expect(safePositiveNumber("1")).toBe(1);
        });

        it("应该将负数转换为默认值", () => {
            expect(safePositiveNumber(-42)).toBe(1); // 负数使用默认值
            expect(safePositiveNumber(-1)).toBe(1);
            expect(safePositiveNumber("-10")).toBe(1); // 负数字符串转为-10，然后使用默认值
        });

        it("应该将0转换为默认值", () => {
            expect(safePositiveNumber(0)).toBe(1);
            expect(safePositiveNumber("0")).toBe(1);
        });

        it("应该在无法转换时使用默认值", () => {
            expect(safePositiveNumber("abc")).toBe(1);
            expect(safePositiveNumber("")).toBe(1);
            expect(safePositiveNumber("not-a-number")).toBe(1);
        });

        it("应该使用自定义默认值", () => {
            expect(safePositiveNumber(0, 100)).toBe(100);
            expect(safePositiveNumber(-5, 50)).toBe(50);
            expect(safePositiveNumber("abc", 200)).toBe(200);
        });

        it("应该处理负的默认值", () => {
            expect(safePositiveNumber(0, -10)).toBe(1); // defaultValue <= 0，使用1
            expect(safePositiveNumber(-5, -20)).toBe(1);
        });

        it("应该处理默认值为0的情况", () => {
            expect(safePositiveNumber(0, 0)).toBe(1); // 0默认值转为1
            expect(safePositiveNumber(-5, 0)).toBe(1);
        });

        it("应该处理边界情况", () => {
            expect(safePositiveNumber(0.5)).toBe(0.5); // 数字类型直接返回
            expect(safePositiveNumber("0.9")).toBe(1); // parseInt("0.9") = 0，使用默认值
            expect(safePositiveNumber("1.1")).toBe(1); // parseInt("1.1") = 1
        });

        it("应该处理特殊输入", () => {
            expect(safePositiveNumber(null as any)).toBe(1);
            expect(safePositiveNumber(undefined as any)).toBe(1);
            expect(safePositiveNumber({} as any)).toBe(1);
            expect(safePositiveNumber([] as any)).toBe(1);
        });

        it("应该处理Infinity", () => {
            expect(safePositiveNumber(Infinity)).toBe(Infinity);
            expect(safePositiveNumber(-Infinity, 5)).toBe(5); // 负无穷使用默认值的绝对值
        });

        it("应该验证实际使用场景", () => {
            // 模拟thumbnailSize从localStorage读取的场景
            expect(safePositiveNumber("203", 150)).toBe(203); // 正常字符串数字
            expect(safePositiveNumber("0", 150)).toBe(150); // 0使用默认值
            expect(safePositiveNumber("", 150)).toBe(150); // 空字符串使用默认值
            expect(safePositiveNumber("-50", 150)).toBe(150); // 负数使用默认值
            expect(safePositiveNumber("abc", 150)).toBe(150); // 无效值使用默认值
        });
    });
});
