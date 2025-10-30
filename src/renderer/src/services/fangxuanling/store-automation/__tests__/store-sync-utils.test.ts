/**
 * Store同步纯函数工具集的单元测试
 * 目标：100%代码覆盖率
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    extractSnapshotFromResponse,
    syncStoreWithSnapshot,
    getStoreFieldData,
    setStoreFieldData,
} from "../store-sync-utils";
import type { ZhaolingResponse } from "@renderer/interfaces/yuan-tian-gang.interface";
import type { MatterSyncMetadata } from "../index";
import type { PreferenceState } from "@renderer/stores/preference";

// Mock logger
vi.mock("@common/logger", () => ({
    loggers: {
        fangxuanling: {
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
        },
    },
}));

// Mock utils
vi.mock("../../utils", () => ({
    mergeStoreData: vi.fn((storeData, _propertyPath, snapshot) => ({
        ...storeData,
        ...(snapshot as Record<string, unknown>),
    })),
    // 保留旧函数名用于向后兼容
    mergePreferencesFromTianjie: vi.fn((storePrefs, _storePath, snapshot) => ({
        ...storePrefs,
        ...(snapshot as Record<string, unknown>),
    })),
}));

describe("store-sync-utils", () => {
    describe("extractSnapshotFromResponse", () => {
        it("应该成功从响应中提取简单路径的snapshot", () => {
            const response: ZhaolingResponse = {
                acknowledged: true,
                command: "test",
                data: {
                    snapshot: {
                        ui: { theme: "dark" },
                    },
                },
                blessing: "",
                timestamp: 0,
            };

            const result = extractSnapshotFromResponse(response, "snapshot");
            expect(result).toEqual({ ui: { theme: "dark" } });
        });

        it("应该成功从响应中提取嵌套路径的snapshot", () => {
            const response: ZhaolingResponse = {
                acknowledged: true,
                command: "test",
                data: {
                    result: {
                        snapshot: {
                            ui: { theme: "dark" },
                        },
                    },
                },
                blessing: "",
                timestamp: 0,
            };

            const result = extractSnapshotFromResponse(response, "result.snapshot");
            expect(result).toEqual({ ui: { theme: "dark" } });
        });

        it("应该在路径不存在时返回null", () => {
            const response: ZhaolingResponse = {
                acknowledged: true,
                command: "test",
                data: {
                    something: "else",
                },
                blessing: "",
                timestamp: 0,
            };

            const result = extractSnapshotFromResponse(response, "snapshot");
            expect(result).toBeNull();
        });

        it("应该成功提取非对象类型的snapshot（验证由策略函数负责）", () => {
            const response: ZhaolingResponse = {
                acknowledged: true,
                command: "test",
                data: {
                    snapshot: "not an object",
                },
                blessing: "",
                timestamp: 0,
            };

            const result = extractSnapshotFromResponse(response, "snapshot");
            // extractSnapshotFromResponse只负责路径提取，不验证类型
            // 类型验证由各个策略函数（applyMergeStrategy等）负责
            expect(result).toBe("not an object");
        });

        it("应该在提取过程中捕获异常并返回null", () => {
            const response = {
                acknowledged: true,
                command: "test",
                data: null,
            } as unknown as ZhaolingResponse;

            const result = extractSnapshotFromResponse(response, "snapshot.deep.path");
            expect(result).toBeNull();
        });
    });

    describe("syncStoreWithSnapshot", () => {
        let mockStore: Record<string, unknown> & {
            $patch: (data: Record<string, unknown>) => void;
        };

        beforeEach(() => {
            mockStore = {
                ui: { theme: "light", language: "en" },
                display: { thumbnailSize: 100 },
                $state: {} as PreferenceState,
                $patch: vi.fn(),
            } as Record<string, unknown> & {
                $patch: (data: Record<string, unknown>) => void;
            };
        });

        it("应该成功使用merge策略同步Store", () => {
            const response: ZhaolingResponse = {
                acknowledged: true,
                command: "test",
                data: {
                    snapshot: {
                        ui: { theme: "dark" },
                    },
                },
                blessing: "",
                timestamp: 0,
            };

            const syncMetadata: MatterSyncMetadata = {
                propertyPath: "snapshot",
                syncStrategy: "merge",
                storeName: "preferences",
                autoSync: true,
                description: "test",
            };

            const result = syncStoreWithSnapshot("theme_change", response, syncMetadata, mockStore);

            expect(result).toBe(true);
        });

        it("应该成功使用replace策略同步Store", () => {
            const response: ZhaolingResponse = {
                acknowledged: true,
                command: "test",
                data: {
                    snapshot: {
                        ui: { theme: "dark" },
                    },
                },
                blessing: "",
                timestamp: 0,
            };

            const syncMetadata: MatterSyncMetadata = {
                propertyPath: "snapshot",
                syncStrategy: "replace",
                storeName: "preferences.ui",
                autoSync: true,
                description: "test",
            };

            const result = syncStoreWithSnapshot("theme_change", response, syncMetadata, mockStore);

            expect(result).toBe(true);
        });

        it("应该在snapshot提取失败时返回false", () => {
            const response: ZhaolingResponse = {
                acknowledged: true,
                command: "test",
                data: {
                    something: "else",
                },
                blessing: "",
                timestamp: 0,
            };

            const syncMetadata: MatterSyncMetadata = {
                propertyPath: "snapshot",
                syncStrategy: "merge",
                storeName: "preferences",
                autoSync: true,
                description: "test",
            };

            const result = syncStoreWithSnapshot("theme_change", response, syncMetadata, mockStore);

            expect(result).toBe(false);
        });

        it("应该在使用未知策略时返回false", () => {
            const response: ZhaolingResponse = {
                acknowledged: true,
                command: "test",
                data: {
                    snapshot: {
                        ui: { theme: "dark" },
                    },
                },
                blessing: "",
                timestamp: 0,
            };

            const syncMetadata: MatterSyncMetadata = {
                propertyPath: "snapshot",
                syncStrategy: "unknown" as unknown as "merge",
                storeName: "preferences",
                autoSync: true,
                description: "test",
            };

            const result = syncStoreWithSnapshot("theme_change", response, syncMetadata, mockStore);

            expect(result).toBe(false);
        });

        it("应该在执行过程中捕获异常并返回false", () => {
            const response = null as unknown as ZhaolingResponse;

            const syncMetadata: MatterSyncMetadata = {
                propertyPath: "snapshot",
                syncStrategy: "merge",
                storeName: "preferences",
                autoSync: true,
                description: "test",
            };

            const result = syncStoreWithSnapshot("theme_change", response, syncMetadata, mockStore);

            expect(result).toBe(false);
        });

        it("应该在$patch抛出异常时返回false", () => {
            // 创建一个抛出异常的mock store
            const errorStore: Record<string, unknown> & {
                $patch: (data: Record<string, unknown>) => void;
            } = {
                preferences: {
                    ui: { theme: "light", language: "en" },
                    display: { thumbnailSize: 100 },
                },
                $state: {},
                $patch: vi.fn(() => {
                    throw new Error("Store update failed");
                }),
            };

            const response: ZhaolingResponse = {
                acknowledged: true,
                command: "test",
                data: {
                    snapshot: {
                        ui: { theme: "dark" },
                    },
                },
                blessing: "",
                timestamp: 0,
            };

            const syncMetadata: MatterSyncMetadata = {
                propertyPath: "snapshot",
                syncStrategy: "merge",
                storeName: "preferences",
                autoSync: true,
                description: "test",
            };

            const result = syncStoreWithSnapshot(
                "theme_change",
                response,
                syncMetadata,
                errorStore,
            );

            expect(result).toBe(false);
        });
    });

    describe("getStoreFieldData", () => {
        it("应该成功获取单层路径的数据", () => {
            const store: Record<string, unknown> = {
                preferences: {
                    ui: { theme: "light" },
                },
            };

            const result = getStoreFieldData(store, "preferences");
            expect(result).toEqual({ ui: { theme: "light" } });
        });

        it("应该成功获取嵌套路径的数据", () => {
            const store: Record<string, unknown> = {
                preferences: {
                    ui: { theme: "light", language: "en" },
                },
            };

            const result = getStoreFieldData(store, "preferences.ui");
            expect(result).toEqual({ theme: "light", language: "en" });
        });

        it("应该在路径不存在时返回空对象", () => {
            const store: Record<string, unknown> = {
                preferences: {},
            };

            const result = getStoreFieldData(store, "nonexistent");
            expect(result).toEqual({});
        });
    });

    describe("setStoreFieldData", () => {
        it("应该成功设置单层路径的数据", () => {
            const mockPatch = vi.fn();
            const store: Record<string, unknown> & {
                $patch: (fn: (state: unknown) => void) => void;
            } = {
                ui: { theme: "light" },
                display: { thumbnailSize: 100 },
                $patch: mockPatch,
            };

            const newData = { theme: "dark" };
            setStoreFieldData(store, "ui", newData);

            // 验证使用函数式 $patch
            expect(mockPatch).toHaveBeenCalledTimes(1);
            expect(typeof mockPatch.mock.calls[0][0]).toBe("function");

            // 验证函数执行后的效果
            const patchFn = mockPatch.mock.calls[0][0];
            patchFn(store);
            expect(store.ui).toEqual(newData);
        });

        it("应该成功设置嵌套路径的数据", () => {
            const mockPatch = vi.fn();
            const store: Record<string, unknown> & {
                $patch: (fn: (state: unknown) => void) => void;
            } = {
                ui: { theme: "light", language: "en" },
                display: { thumbnailSize: 100 },
                $patch: mockPatch,
            };

            const newData = { theme: "dark", language: "zh" };
            setStoreFieldData(store, "ui", newData);

            // 验证使用函数式 $patch
            expect(mockPatch).toHaveBeenCalledTimes(1);
            expect(typeof mockPatch.mock.calls[0][0]).toBe("function");

            // 验证函数执行后的效果
            const patchFn = mockPatch.mock.calls[0][0];
            patchFn(store);
            expect((store as Record<string, unknown>).ui).toEqual(newData);
        });

        it("应该成功设置多层嵌套路径的数据", () => {
            const mockPatch = vi.fn();
            const store: Record<string, unknown> & {
                $patch: (fn: (state: unknown) => void) => void;
            } = {
                ui: {
                    theme: { mode: "light", variant: "default" },
                    language: "en",
                },
                display: { thumbnailSize: 100 },
                $patch: mockPatch,
            };

            const newData = { mode: "dark", variant: "blue" };
            setStoreFieldData(store, "ui.theme", newData);

            // 验证使用函数式 $patch
            expect(mockPatch).toHaveBeenCalledTimes(1);
            expect(typeof mockPatch.mock.calls[0][0]).toBe("function");

            // 验证函数执行后的效果，并确认其他属性未被覆盖
            const patchFn = mockPatch.mock.calls[0][0];
            patchFn(store);
            const ui = (store as Record<string, unknown>).ui as Record<string, unknown>;
            expect(ui.theme).toEqual(newData);
            expect(ui.language).toBe("en"); // ✅ 验证其他属性未被覆盖
        });
    });
});
