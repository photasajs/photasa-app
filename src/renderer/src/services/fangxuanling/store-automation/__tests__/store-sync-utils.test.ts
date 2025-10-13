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
} from "../store-sync-utils";
import type { ZhaolingResponse } from "@renderer/interfaces/yuan-tian-gang.interface";
import type { MatterSyncMetadata } from "../index";
import type { PreferenceState } from "@renderer/stores/preference";

// Mock logger
vi.mock("@common/logger", () => ({
    loggers: {
        fangxuanling: {
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

        it("应该在snapshot不是对象时返回null", () => {
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
            expect(result).toBeNull();
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
            const storePreferences = {
                ui: { theme: "light", language: "en" },
                display: { thumbnailSize: 100 },
            } as unknown as PreferenceState["preferences"];

            const snapshot = {
                ui: { theme: "dark" },
            };

            const result = applyMergeStrategy(storePreferences, snapshot);

            // 验证mergePreferencesFromTianjie被调用
            expect(result).toBeDefined();
            expect(result.ui).toBeDefined();
        });

        it("应该在snapshot无效时返回原Store数据", () => {
            const storePreferences = {
                ui: { theme: "light" },
            } as unknown as PreferenceState["preferences"];

            const result = applyMergeStrategy(storePreferences, null);
            expect(result).toBe(storePreferences);
        });

        it("应该在snapshot不是对象时返回原Store数据", () => {
            const storePreferences = {
                ui: { theme: "light" },
            } as unknown as PreferenceState["preferences"];

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

            expect(result.preferences.ui).toEqual(snapshot);
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
            const storePreferences = {
                ui: { theme: "light", language: "en" },
                display: { thumbnailSize: 100 },
            } as unknown as PreferenceState["preferences"];

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
            const storePreferences = {
                ui: { theme: "light" },
            } as unknown as PreferenceState["preferences"];

            const result = applyPatchStrategy(storePreferences, null);
            expect(result).toBe(storePreferences);
        });

        it("应该在snapshot不是对象时返回原Store数据", () => {
            const storePreferences = {
                ui: { theme: "light" },
            } as unknown as PreferenceState["preferences"];

            const result = applyPatchStrategy(storePreferences, 123);
            expect(result).toBe(storePreferences);
        });
    });

    describe("syncStoreWithSnapshot", () => {
        let mockStore: {
            preferences: PreferenceState["preferences"];
            $state: PreferenceState;
        };

        beforeEach(() => {
            mockStore = {
                preferences: {
                    ui: { theme: "light", language: "en" },
                    display: { thumbnailSize: 100 },
                } as unknown as PreferenceState["preferences"],
                $state: {} as PreferenceState,
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

        it("应该在applyPreferencesToStore抛出异常时返回false", async () => {
            // 导入mock模块
            const utilsMock = await import("../../utils");

            // 临时mock applyPreferencesToStore抛出异常
            const originalImpl = utilsMock.applyPreferencesToStore;
            vi.mocked(utilsMock.applyPreferencesToStore).mockImplementationOnce(() => {
                throw new Error("Store update failed");
            });

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

            expect(result).toBe(false);

            // 恢复原始实现
            vi.mocked(utilsMock.applyPreferencesToStore).mockImplementation(originalImpl);
        });
    });
});
