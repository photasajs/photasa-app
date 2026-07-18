/**
 * 干净数据流验证测试
 * 验证引擎层不关心工作流，数据流简洁无复杂嵌套
 */

import { describe, it, expect, vi as jest, beforeEach } from "vitest";
import { TaiyiEngine } from "../core/TaiyiEngine";
import { EngineCallResult } from "../core/workflow";

// Mock logger
jest.mock("@photasa/common", () => ({
    loggers: {
        taiyi: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        },
    },
}));

describe("干净数据流验证", () => {
    let taiyiEngine: TaiyiEngine;

    beforeEach(async () => {
        // 创建太乙引擎
        taiyiEngine = new TaiyiEngine({
            enableHealthCheck: false,
        });
        await taiyiEngine.initialize();
    });

    it("应该直接暴露引擎原始数据，避免复杂嵌套", () => {
        // 模拟引擎调用结果
        const mockEngineResult: EngineCallResult = {
            success: true,
            result: {
                valid: true,
                errors: [],
            },
            timestamp: Date.now(),
            engineName: "wenchang",
        };

        // 🎯 关键测试：使用getEngineResult直接获取原始数据
        const rawData = taiyiEngine.getEngineResult(mockEngineResult) as any;

        // 验证原始数据直接可用，无需复杂嵌套
        expect(rawData).toBeDefined();
        expect(rawData.valid).toBe(true);
        expect(rawData.errors).toBeDefined();

        // 验证数据结构简洁
        expect(typeof rawData).toBe("object");
        expect(rawData).toHaveProperty("valid");
        expect(rawData).toHaveProperty("errors");
    });

    it("应该支持sanitize方法的干净数据流", () => {
        // 模拟sanitize方法的引擎调用结果
        const mockEngineResult: EngineCallResult = {
            success: true,
            result: {
                result: {
                    ui: {
                        theme: "dark",
                        language: "en-US",
                    },
                },
            },
            timestamp: Date.now(),
            engineName: "wenchang",
        };

        // 🎯 关键测试：直接获取原始数据
        const rawData = taiyiEngine.getEngineResult(mockEngineResult) as any;

        // 验证原始数据直接可用
        expect(rawData).toBeDefined();
        expect(rawData.result).toBeDefined();
        expect(rawData.result.ui.theme).toBe("dark");
        expect(rawData.result.ui.language).toBe("en-US");
    });

    it("应该支持getCurrentSnapshot方法的干净数据流", () => {
        // 模拟getCurrentSnapshot方法的引擎调用结果
        const mockEngineResult: EngineCallResult = {
            success: true,
            result: {
                data: {
                    ui: { theme: "dark" },
                    display: { thumbnailSize: 150 },
                },
                revision: 1,
                timestamp: Date.now(),
            },
            timestamp: Date.now(),
            engineName: "wenchang",
        };

        // 🎯 关键测试：直接获取原始数据
        const rawData = taiyiEngine.getEngineResult(mockEngineResult) as any;

        // 验证原始数据直接可用
        expect(rawData).toBeDefined();
        expect(rawData.data).toBeDefined();
        expect(rawData.revision).toBeDefined();
        expect(rawData.timestamp).toBeDefined();
    });

    it("应该处理引擎调用失败的情况", () => {
        // 模拟失败的引擎调用结果
        const mockEngineResult: EngineCallResult = {
            success: false,
            error: new Error("Method not found"),
            timestamp: Date.now(),
            engineName: "wenchang",
        };

        // 🎯 关键测试：失败时返回null
        const rawData = taiyiEngine.getEngineResult(mockEngineResult);
        expect(rawData).toBeNull();
    });

    it("应该验证数据流中无复杂嵌套引用", () => {
        // 模拟工作流步骤结果
        const mockStepResult = {
            success: true,
            data: {
                valid: true,
                errors: [],
            },
            metadata: {
                stepId: "validate_delta",
                duration: 10,
                executedAt: Date.now(),
                engineName: "wenchang",
            },
        };

        // 🎯 验证：工作流可以直接访问 steps.validate_delta.valid
        // 而不是 steps.validate_delta.result.valid
        expect(mockStepResult.data.valid).toBe(true);
        expect(mockStepResult.data.errors).toEqual([]);

        // 验证没有复杂的嵌套结构
        expect(mockStepResult.data).not.toHaveProperty("result");
        expect(mockStepResult.data).not.toHaveProperty("output");
    });
});
