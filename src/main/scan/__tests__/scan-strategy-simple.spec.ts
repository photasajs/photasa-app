/*
 * scan-strategy-simple.spec.ts
 *
 * 扫描策略简单测试 - 验证核心修复功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { decideScanStrategy } from "../strategy/scan-strategy";
import { PhotasaLogger } from "@common/logger";
import fs from "fs-extra";

describe("扫描策略核心功能测试", () => {
    let mockLogger: PhotasaLogger;
    let testDir: string;

    beforeEach(() => {
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        } as any;

        testDir = "/test/folder";
    });

    describe("强制重新扫描测试", () => {
        it("应该为 rescan 动作总是返回 FULL 策略", async () => {
            // 执行测试
            const result = await decideScanStrategy(testDir, mockLogger, "rescan");

            // 验证结果
            expect(result.strategy).toBe("full");
            expect(result.reason).toBe("强制重新扫描");
            expect(mockLogger.info).toHaveBeenCalledWith(
                `[decideScanStrategy] 强制重新扫描: ${testDir}`,
            );
        });

        it("应该忽略 .photasa.json 存在性，强制执行完整扫描", async () => {
            // 即使有配置文件，rescan 也应该返回 FULL
            const result = await decideScanStrategy(testDir, mockLogger, "rescan");

            // 验证结果
            expect(result.strategy).toBe("full");
            expect(result.reason).toBe("强制重新扫描");
        });
    });

    describe("扫描动作测试", () => {
        it("应该为 scan 动作检查配置文件", async () => {
            // 模拟配置文件不存在
            vi.spyOn(fs, "existsSync").mockReturnValue(false);

            // 执行测试
            const result = await decideScanStrategy(testDir, mockLogger, "scan");

            // 验证结果 - 由于没有配置文件，应该返回 FULL
            expect(result.strategy).toBe("full");
            expect(result.reason).toBe("配置文件不存在");
        });
    });
});
