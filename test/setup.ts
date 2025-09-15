import { config } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { createPinia } from "pinia";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/vue";

// Create i18n instance
const i18n = createI18n({
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    messages: {
        en: {
            // Add your English translations here
        },
    },
});

// Create Pinia instance
const pinia = createPinia();

// Configure Vue Test Utils
config.global.plugins = [i18n, pinia];

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

// Clean up after each test
afterEach(() => {
    cleanup();
});
