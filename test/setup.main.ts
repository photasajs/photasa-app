import { afterEach, beforeEach, vi } from "vitest";

// Mock sharp module to avoid platform-specific errors
vi.mock("sharp", () => {
    const mockSharp = vi.fn(() => ({
        resize: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from([])),
        png: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        metadata: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
    }));
    
    return {
        default: mockSharp,
    };
});

// Mock Date.now for performance tests
const mockDateNow = vi.fn(() => 1640995200000); // 2022-01-01T00:00:00.000Z
Object.defineProperty(Date, "now", {
    value: mockDateNow,
    writable: true,
});

// Ensure Date.now is always available
global.Date.now = mockDateNow;

// 每个测试前重置mocks
beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
});

// Clean up after each test
afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
});
