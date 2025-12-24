import { config } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { createPinia } from "pinia";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/vue";

// 创建全局 i18n 实例避免重复创建
let globalI18n: ReturnType<typeof createI18n> | null = null;

function getOrCreateI18n() {
    if (!globalI18n) {
        globalI18n = createI18n({
            legacy: false,
            locale: "en",
            fallbackLocale: "en",
            messages: {
                en: {
                    import: {
                        steps: {
                            configuration: "Configuration",
                            configurationDesc: "Configure import settings",
                            preview: "Preview",
                            previewDesc: "Preview files to import",
                        },
                        duplicate: {
                            rename: "Rename",
                            skip: "Skip",
                            overwrite: "Overwrite",
                            keepBoth: "Keep Both",
                        },
                        fileTypes: {
                            label: "File Types",
                        },
                    },
                },
            },
            // 添加missingWarn和fallbackWarn配置
            missingWarn: false,
            fallbackWarn: false,
            // 添加silentTranslationWarn配置
            silentTranslationWarn: true,
            silentFallbackWarn: true,
            // 添加datetimeFormats配置以避免Date.now问题
            datetimeFormats: {
                en: {
                    short: {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                    },
                },
            },
        });
    }
    return globalI18n;
}

// 每个测试使用新的 Pinia 实例
function createTestPinia() {
    return createPinia();
}

// 配置全局选项，只在模块加载时设置一次
config.global.plugins = [getOrCreateI18n()];

// 每个测试前重置 Pinia
beforeEach(() => {
    // 只重新设置 Pinia，不重复设置 i18n
    config.global.plugins = [getOrCreateI18n(), createTestPinia()];
});

// Mock Date.now for performance tests
const mockDateNow = vi.fn(() => 1640995200000); // 2022-01-01T00:00:00.000Z
Object.defineProperty(Date, "now", {
    value: mockDateNow,
    writable: true,
});

// Ensure Date.now is always available
global.Date.now = mockDateNow;

// Mock Date constructor to return consistent dates
const mockDate = new Date(1640995200000); // 2022-01-01T00:00:00.000Z
const OriginalDate = global.Date;

// Mock Date constructor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.Date = class extends OriginalDate {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
        if (args.length === 0) {
            super(mockDate.getTime());
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            // @ts-expect-error - Date constructor accepts various argument types
            super(...args);
        }
    }

    static now() {
        return mockDateNow();
    }

    toISOString() {
        return mockDate.toISOString();
    }

    getTime() {
        return mockDate.getTime();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// Copy static methods without causing circular reference
Object.defineProperty(global.Date, "now", {
    value: mockDateNow,
    writable: true,
});

// Copy other static methods if needed
Object.defineProperty(global.Date, "parse", {
    value: OriginalDate.parse,
    writable: true,
});

Object.defineProperty(global.Date, "UTC", {
    value: OriginalDate.UTC,
    writable: true,
});

// 确保window对象存在并具有必要的方法
if (typeof window !== "undefined") {
    // 确保window.addEventListener存在
    if (!window.addEventListener) {
        window.addEventListener = vi.fn();
    }
    // 确保window.removeEventListener存在
    if (!window.removeEventListener) {
        window.removeEventListener = vi.fn();
    }
    // 确保document.addEventListener存在
    if (typeof document !== "undefined" && !document.addEventListener) {
        document.addEventListener = vi.fn();
    }
    // 确保Event构造函数可用
    if (!window.Event) {
        window.Event = global.Event as typeof Event;
    }
    // 确保MouseEvent构造函数可用
    if (!window.MouseEvent) {
        window.MouseEvent = global.MouseEvent as typeof MouseEvent;
    }
    // 确保KeyboardEvent构造函数可用
    if (!window.KeyboardEvent) {
        window.KeyboardEvent = global.KeyboardEvent as typeof KeyboardEvent;
    }
}

// Clean up after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
});
