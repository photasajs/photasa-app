import { vi } from "vitest";
import type { PhotasaLogger } from "@photasa/common";

/**
 * 创建测试用的Logger对象
 */
export function createTestLogger(): PhotasaLogger {
    return {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    } as any;
}
