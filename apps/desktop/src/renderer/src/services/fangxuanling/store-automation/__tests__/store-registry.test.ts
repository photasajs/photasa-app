/**
 * Store注册表的单元测试
 * 目标：100%代码覆盖率
 */

import { describe, it, expect, vi } from "vitest";
import { extractStoreName, getStoreByPath, isValidStorePath } from "../store-registry";

// Mock logger
vi.mock("@common/logger", () => ({
    loggers: {
        fangxuanling: {
            debug: vi.fn(),
            error: vi.fn(),
        },
    },
}));

// Mock stores
vi.mock("@renderer/stores/preference", () => ({
    usePreferenceStore: vi.fn(() => ({
        preferences: { ui: { theme: "light" } },
        $state: {},
        $patch: vi.fn(),
    })),
}));

vi.mock("@renderer/stores/notification", () => ({
    useNotificationStore: vi.fn(() => ({
        notifications: [],
        $state: {},
        $patch: vi.fn(),
    })),
}));

vi.mock("@renderer/stores/photos", () => ({
    usePhotosStore: vi.fn(() => ({
        currentFolder: null,
        $state: {},
        $patch: vi.fn(),
    })),
}));

describe("store-registry", () => {
    describe("extractStoreName", () => {
        it("应该从简单路径中提取Store名称", () => {
            const result = extractStoreName("preferences");
            expect(result).toBe("preferences");
        });

        it("应该从嵌套路径中提取Store名称", () => {
            const result = extractStoreName("preferences.ui.theme");
            expect(result).toBe("preferences");
        });

        it("应该从多层嵌套路径中提取Store名称", () => {
            const result = extractStoreName("notification.items.0.message");
            expect(result).toBe("notification");
        });
    });

    describe("isValidStorePath", () => {
        it("应该验证有效的Store路径", () => {
            expect(isValidStorePath("preferences")).toBe(true);
            expect(isValidStorePath("notification")).toBe(true);
            expect(isValidStorePath("photos")).toBe(true);
        });

        it("应该验证有效的嵌套Store路径", () => {
            expect(isValidStorePath("preferences.ui.theme")).toBe(true);
            expect(isValidStorePath("notification.items")).toBe(true);
        });

        it("应该拒绝无效的Store路径", () => {
            expect(isValidStorePath("invalid")).toBe(false);
            expect(isValidStorePath("unknown.path")).toBe(false);
        });
    });

    describe("getStoreByPath", () => {
        it("应该成功获取preferences Store", () => {
            const store = getStoreByPath("preferences");
            expect(store).toBeDefined();
            expect(store).toHaveProperty("preferences");
        });

        it("应该成功获取notification Store", () => {
            const store = getStoreByPath("notification");
            expect(store).toBeDefined();
            expect(store).toHaveProperty("notifications");
        });

        it("应该成功获取photos Store", () => {
            const store = getStoreByPath("photos");
            expect(store).toBeDefined();
            expect(store).toHaveProperty("currentFolder");
        });

        it("应该从嵌套路径中获取Store", () => {
            const store = getStoreByPath("preferences.ui.theme");
            expect(store).toBeDefined();
            expect(store).toHaveProperty("preferences");
        });

        it("应该在Store不存在时返回null", () => {
            const store = getStoreByPath("invalid");
            expect(store).toBeNull();
        });

        it("应该在未知的嵌套路径中返回null", () => {
            const store = getStoreByPath("unknown.nested.path");
            expect(store).toBeNull();
        });
    });
});
