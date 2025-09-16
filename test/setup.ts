import { config } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { createPinia } from "pinia";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/vue";

// Factory functions to create fresh instances for each test
function createTestI18n() {
    return createI18n({
        legacy: false,
        locale: "en",
        fallbackLocale: "en",
        messages: {
            en: {
                // Add your English translations here
            },
        },
    });
}

function createTestPinia() {
    return createPinia();
}

// Configure Vue Test Utils with factory functions
beforeEach(() => {
    // Create fresh instances for each test to avoid conflicts
    config.global.plugins = [createTestI18n(), createTestPinia()];
});

// Mock fs-extra for tests
vi.mock("fs-extra", () => ({
    default: {
        existsSync: vi.fn(() => true),
        ensureFile: vi.fn(),
        ensureDir: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        stat: vi.fn(),
        statSync: vi.fn(() => ({
            isFile: () => true,
            isDirectory: () => false,
            mtime: new Date(),
            size: 1024,
        })),
        pathExists: vi.fn(() => Promise.resolve(true)),
        remove: vi.fn(() => Promise.resolve()),
        removeSync: vi.fn(),
        mkdtemp: vi.fn(() => Promise.resolve("/tmp/test-dir")),
        chmod: vi.fn(() => Promise.resolve()),
    },
    existsSync: vi.fn(() => true),
    ensureFile: vi.fn(),
    ensureDir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    statSync: vi.fn(() => ({
        isFile: () => true,
        isDirectory: () => false,
        mtime: new Date(),
        size: 1024,
    })),
    pathExists: vi.fn(() => Promise.resolve(true)),
    remove: vi.fn(() => Promise.resolve()),
    removeSync: vi.fn(),
    mkdtemp: vi.fn(() => Promise.resolve("/tmp/test-dir")),
    chmod: vi.fn(() => Promise.resolve()),
}));

// Mock window object for tests
Object.defineProperty(window, "addEventListener", {
    value: vi.fn(),
    writable: true,
});

Object.defineProperty(window, "removeEventListener", {
    value: vi.fn(),
    writable: true,
});

Object.defineProperty(window, "dispatchEvent", {
    value: vi.fn(),
    writable: true,
});

// Mock Date.now for performance tests
const mockDateNow = vi.fn(() => 1640995200000); // 2022-01-01T00:00:00.000Z
Object.defineProperty(Date, "now", {
    value: mockDateNow,
    writable: true,
});

// Clean up after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});
