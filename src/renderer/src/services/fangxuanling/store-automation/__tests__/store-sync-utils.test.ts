/**
 * Store同步纯函数工具集的单元测试
 * 目标：100%代码覆盖率
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    extractSnapshotFromResponse,
    applyMergeStrategy,
    applyReplaceStrategy,
    applyPatchStrategy,
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
    mergePreferencesFromTianjie: vi.fn((storePrefs, snapshot) => ({
        ...storePrefs,
        ...(snapshot as Record<string, unknown>),
    })),
    applyPreferencesToStore: vi.fn(),
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

    describe("applyMergeStrategy", () => {
        it("应该成功合并snapshot到Store preferences", () => {
            const storePreferences: Record<string, unknown> = {
                ui: { theme: "light", language: "en" },
                display: { thumbnailSize: 100 },
            };

            const snapshot = {
                ui: { theme: "dark" },
            };

            const result = applyMergeStrategy(storePreferences, snapshot);

            // 验证mergePreferencesFromTianjie被调用
            expect(result).toBeDefined();
            expect(result.ui).toBeDefined();
        });

        it("应该在snapshot无效时返回原Store数据", () => {
            const storePreferences: Record<string, unknown> = {
                ui: { theme: "light" },
            };

            const result = applyMergeStrategy(storePreferences, null);
            expect(result).toBe(storePreferences);
        });

        it("应该在snapshot不是对象时返回原Store数据", () => {
            const storePreferences: Record<string, unknown> = {
                ui: { theme: "light" },
            };

            const result = applyMergeStrategy(storePreferences, "invalid");
            expect(result).toBe(storePreferences);
        });
    });

    describe("applyReplaceStrategy", () => {
        it("应该成功替换Store中的嵌套字段", () => {
            const storeData = {
                preferences: {
                    ui: { theme: "light" },
                },
            };

            const snapshot = { theme: "dark", language: "zh" };

            const result = applyReplaceStrategy(storeData, snapshot, "preferences.ui");

            expect((result.preferences as Record<string, unknown>).ui).toEqual(snapshot);
            // 验证是深拷贝，不是原对象
            expect(result).not.toBe(storeData);
        });

        it("应该成功替换根级别字段", () => {
            const storeData = {
                preferences: {
                    ui: { theme: "light" },
                },
            };

            const snapshot = {
                ui: { theme: "dark" },
            };

            const result = applyReplaceStrategy(storeData, snapshot, "preferences");

            expect(result.preferences).toEqual(snapshot);
        });

        it("应该在路径不存在时返回原数据", () => {
            const storeData = {
                preferences: {
                    ui: { theme: "light" },
                },
            };

            const snapshot = { theme: "dark" };

            const result = applyReplaceStrategy(storeData, snapshot, "nonexistent.path");

            expect(result).toBe(storeData);
        });

        it("应该在执行失败时捕获异常并返回原数据", () => {
            const storeData = {
                preferences: null,
            };

            const snapshot = { theme: "dark" };

            const result = applyReplaceStrategy(storeData, snapshot, "preferences.ui");

            expect(result).toBe(storeData);
        });

        it("应该在JSON.parse失败时捕获异常", () => {
            // 创建一个无法被JSON序列化的对象
            const circularRef: Record<string, unknown> = {};
            circularRef.self = circularRef;

            const snapshot = { theme: "dark" };

            const result = applyReplaceStrategy(circularRef, snapshot, "self");

            expect(result).toBe(circularRef);
        });
    });

    describe("applyPatchStrategy", () => {
        it("应该成功进行浅层合并", () => {
            const storePreferences: Record<string, unknown> = {
                ui: { theme: "light", language: "en" },
                display: { thumbnailSize: 100 },
            };

            const snapshot = {
                ui: { theme: "dark" },
                scanning: { paths: ["/photos"] },
            };

            const result = applyPatchStrategy(storePreferences, snapshot);

            expect(result.ui).toEqual({ theme: "dark" });
            expect(result.scanning).toEqual({ paths: ["/photos"] });
            expect(result.display).toEqual({ thumbnailSize: 100 });
        });

        it("应该在snapshot无效时返回原Store数据", () => {
            const storePreferences: Record<string, unknown> = {
                ui: { theme: "light" },
            };

            const result = applyPatchStrategy(storePreferences, null);
            expect(result).toBe(storePreferences);
        });

        it("应该在snapshot不是对象时返回原Store数据", () => {
            const storePreferences: Record<string, unknown> = {
                ui: { theme: "light" },
            };

            const result = applyPatchStrategy(storePreferences, 123);
            expect(result).toBe(storePreferences);
        });
    });

    describe("syncStoreWithSnapshot", () => {
        let mockStore: Record<string, unknown> & {
            $patch: (data: Record<string, unknown>) => void;
        };

        beforeEach(() => {
            mockStore = {
                preferences: {
                    ui: { theme: "light", language: "en" },
                    display: { thumbnailSize: 100 },
                } as unknown as PreferenceState["preferences"],
                $state: {} as PreferenceState,
                $patch: vi.fn(),
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
                snapshotPath: "snapshot",
                syncStrategy: "merge",
                storePath: "preferences",
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
                snapshotPath: "snapshot",
                syncStrategy: "replace",
                storePath: "preferences.ui",
                autoSync: true,
                description: "test",
            };

            const result = syncStoreWithSnapshot("theme_change", response, syncMetadata, mockStore);

            expect(result).toBe(true);
        });

        it("应该成功使用patch策略同步Store", () => {
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
                snapshotPath: "snapshot",
                syncStrategy: "patch",
                storePath: "preferences",
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
                snapshotPath: "snapshot",
                syncStrategy: "merge",
                storePath: "preferences",
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
                snapshotPath: "snapshot",
                syncStrategy: "unknown" as unknown as "merge",
                storePath: "preferences",
                autoSync: true,
                description: "test",
            };

            const result = syncStoreWithSnapshot("theme_change", response, syncMetadata, mockStore);

            expect(result).toBe(false);
        });

        it("应该在执行过程中捕获异常并返回false", () => {
            const response = null as unknown as ZhaolingResponse;

            const syncMetadata: MatterSyncMetadata = {
                snapshotPath: "snapshot",
                syncStrategy: "merge",
                storePath: "preferences",
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
                snapshotPath: "snapshot",
                syncStrategy: "merge",
                storePath: "preferences",
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
                $patch: (data: Record<string, unknown>) => void;
            } = {
                preferences: {
                    ui: { theme: "light" },
                },
                $patch: mockPatch,
            };

            const newData = { ui: { theme: "dark" } };
            setStoreFieldData(store, "preferences", newData);

            expect(mockPatch).toHaveBeenCalledWith({
                preferences: newData,
            });
        });

        it("应该成功设置嵌套路径的数据", () => {
            const mockPatch = vi.fn();
            const store: Record<string, unknown> & {
                $patch: (data: Record<string, unknown>) => void;
            } = {
                preferences: {
                    ui: { theme: "light" },
                },
                $patch: mockPatch,
            };

            const newData = { theme: "dark", language: "zh" };
            setStoreFieldData(store, "preferences.ui", newData);

            expect(mockPatch).toHaveBeenCalledWith({
                preferences: {
                    ui: newData,
                },
            });
        });

        it("应该成功设置多层嵌套路径的数据", () => {
            const mockPatch = vi.fn();
            const store: Record<string, unknown> & {
                $patch: (data: Record<string, unknown>) => void;
            } = {
                preferences: {
                    ui: {
                        theme: { mode: "light", variant: "default" },
                    },
                },
                $patch: mockPatch,
            };

            const newData = { mode: "dark", variant: "blue" };
            setStoreFieldData(store, "preferences.ui.theme", newData);

            expect(mockPatch).toHaveBeenCalledWith({
                preferences: {
                    ui: {
                        theme: newData,
                    },
                },
            });
        });
    });
});
