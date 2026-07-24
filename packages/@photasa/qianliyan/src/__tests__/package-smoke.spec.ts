import { describe, expect, it } from "vitest";
import { QianliyanEngine } from "../core";

/**
 * 占位冒烟测试：确保包导出的引擎类可被测试运行器加载。
 * （千里眼包此前无 *.spec.ts，vitest run 在无测试文件时会以非零退出码失败，导致 pre-push / CI 失败。）
 */
describe("@photasa/qianliyan 包导出", () => {
    it("应导出 QianliyanEngine 构造函数", () => {
        expect(QianliyanEngine).toBeDefined();
        expect(typeof QianliyanEngine).toBe("function");
    });
});
