/**
 * 偏好镜像测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PreferenceMirror } from "../core/PreferenceMirror";
import type { PreferenceSnapshot, PreferenceDelta, PreferenceChangeEvent } from "../types";

// 模拟窗口环境
const mockInvoke = vi.fn();
const mockOn = vi.fn();
const mockRemoveAllListeners = vi.fn();

const mockWindow = {
    electron: {
        ipcRenderer: {
            invoke: mockInvoke,
            on: mockOn,
            removeAllListeners: mockRemoveAllListeners,
        },
    },
};

// 设置全局窗口对象
Object.defineProperty(global, "window", {
    value: mockWindow,
    writable: true,
});

describe("PreferenceMirror", () => {
    let preferenceMirror: PreferenceMirror;
    let mockSnapshot: PreferenceSnapshot;

    beforeEach(() => {
        // 创建模拟快照
        mockSnapshot = {
            revision: 1,
            data: {
                revision: 1,
                ui: {
                    theme: "auto",
                    layout: "grid",
                    language: "zh-CN",
                    sidebarWidth: 280,
                    zoomLevel: 1.0,
                },
                display: {
                    thumbnailSize: 200,
                    sortOrder: "date",
                    groupBy: "date",
                    showHidden: false,
                    showMetadata: true,
                },
                scanning: {
                    autoScan: true,
                    excludePatterns: [".DS_Store", "Thumbs.db", "*.tmp"],
                    concurrency: 4,
                    watchEnabled: true,
                },
                performance: {
                    maxCacheSize: 500,
                    preloadCount: 20,
                    enableGpuAcceleration: true,
                },
                lastModified: Date.now(),
            },
            timestamp: Date.now(),
        };

        preferenceMirror = new PreferenceMirror({
            enableDebugLogging: false,
            retryAttempts: 2,
            retryDelay: 100,
        });

        // 清除模拟函数的调用记录
        vi.clearAllMocks();
    });

    afterEach(async () => {
        preferenceMirror.destroy();
    });

    describe("初始化", () => {
        it("应该成功初始化镜像", async () => {
            mockInvoke.mockResolvedValueOnce(mockSnapshot);

            await preferenceMirror.initialize();

            expect(mockInvoke).toHaveBeenCalledWith("wenchang.getCurrentSnapshot");
            expect(mockOn).toHaveBeenCalledWith("wenchang.preferenceChanged", expect.any(Function));

            const state = preferenceMirror.getState();
            expect(state.snapshot).toEqual(mockSnapshot);
            expect(state.isLoading).toBe(false);
            expect(state.lastError).toBeNull();
        });

        it("应该处理初始化失败", async () => {
            const error = new Error("IPC连接失败");
            mockInvoke.mockRejectedValueOnce(error);

            await expect(preferenceMirror.initialize()).rejects.toThrow("IPC连接失败");

            const state = preferenceMirror.getState();
            expect(state.snapshot).toBeNull();
            expect(state.isLoading).toBe(false);
            expect(state.lastError).toBe(error);
        });

        it("应该触发初始化完成事件", async () => {
            mockInvoke.mockResolvedValueOnce(mockSnapshot);

            const initListener = vi.fn();
            preferenceMirror.on("initialized", initListener);

            await preferenceMirror.initialize();

            expect(initListener).toHaveBeenCalledWith(mockSnapshot);
        });
    });

    describe("偏好获取", () => {
        beforeEach(async () => {
            mockInvoke.mockResolvedValueOnce(mockSnapshot);
            await preferenceMirror.initialize();
        });

        it("应该返回当前快照的副本", () => {
            const snapshot = preferenceMirror.getCurrentSnapshot();

            expect(snapshot).toEqual(mockSnapshot);
            expect(snapshot).not.toBe(mockSnapshot); // 确保是副本
        });

        it("应该根据路径获取偏好值", () => {
            expect(preferenceMirror.getPreferenceValue("ui.theme")).toBe("auto");
            expect(preferenceMirror.getPreferenceValue("display.thumbnailSize")).toBe(200);
            expect(preferenceMirror.getPreferenceValue("scanning.autoScan")).toBe(true);
        });

        it("应该处理不存在的路径", () => {
            expect(preferenceMirror.getPreferenceValue("nonexistent.path")).toBeUndefined();
            expect(preferenceMirror.getPreferenceValue("ui.nonexistent")).toBeUndefined();
        });

        it("应该在未初始化时抛出错误", () => {
            const uninitializedMirror = new PreferenceMirror();

            expect(() => uninitializedMirror.getPreferenceValue("ui.theme")).toThrow(
                "[PreferenceMirror] 镜像未初始化",
            );
        });
    });

    describe("偏好变更", () => {
        beforeEach(async () => {
            mockInvoke.mockResolvedValueOnce(mockSnapshot);
            await preferenceMirror.initialize();
        });

        it("应该应用偏好变更", async () => {
            const delta: PreferenceDelta = {
                path: "ui.theme",
                value: "dark",
                revision: 1,
            };

            const newRevision = 2;
            mockInvoke.mockResolvedValueOnce(newRevision);

            const result = await preferenceMirror.applyDelta(delta);

            expect(mockInvoke).toHaveBeenCalledWith("wenchang.applyDelta", {
                ...delta,
                revision: mockSnapshot.revision,
            });
            expect(result).toBe(newRevision);
        });

        it("应该使用当前镜像的版本号", async () => {
            const delta: PreferenceDelta = {
                path: "ui.theme",
                value: "dark",
                revision: 999, // 这个会被覆盖
            };

            mockInvoke.mockResolvedValueOnce(2);

            await preferenceMirror.applyDelta(delta);

            expect(mockInvoke).toHaveBeenCalledWith("wenchang.applyDelta", {
                ...delta,
                revision: mockSnapshot.revision, // 使用镜像的版本号
            });
        });

        it("应该处理变更失败", async () => {
            const delta: PreferenceDelta = {
                path: "ui.theme",
                value: "dark",
                revision: 1,
            };

            const error = new Error("版本冲突");
            mockInvoke.mockRejectedValueOnce(error);

            await expect(preferenceMirror.applyDelta(delta)).rejects.toThrow("版本冲突");
        });
    });

    describe("偏好重置和导入", () => {
        beforeEach(async () => {
            mockInvoke.mockResolvedValueOnce(mockSnapshot);
            await preferenceMirror.initialize();
        });

        it("应该重置偏好到默认值", async () => {
            const resetSnapshot: PreferenceSnapshot = {
                ...mockSnapshot,
                revision: 2,
            };

            mockInvoke.mockResolvedValueOnce(resetSnapshot);

            const result = await preferenceMirror.resetToDefaults();

            expect(mockInvoke).toHaveBeenCalledWith("wenchang.resetToDefaults");
            expect(result).toEqual(resetSnapshot);
        });

        it("应该导入偏好配置", async () => {
            const partialPrefs = {
                ui: {
                    theme: "dark" as const,
                    language: "en-US",
                    layout: "grid" as const,
                    sidebarWidth: 280,
                    zoomLevel: 1.0,
                },
            };

            const importedSnapshot: PreferenceSnapshot = {
                ...mockSnapshot,
                revision: 2,
            };

            mockInvoke.mockResolvedValueOnce(importedSnapshot);

            const result = await preferenceMirror.importPreferences(partialPrefs);

            expect(mockInvoke).toHaveBeenCalledWith("wenchang.importPreferences", partialPrefs);
            expect(result).toEqual(importedSnapshot);
        });
    });

    describe("事件处理", () => {
        let eventHandler: (event: PreferenceChangeEvent) => void;

        beforeEach(async () => {
            mockInvoke.mockResolvedValueOnce(mockSnapshot);
            await preferenceMirror.initialize();

            // 获取注册的事件处理器
            eventHandler = mockOn.mock.calls[0][1];
        });

        it("应该处理文昌服务变更事件", () => {
            const newSnapshot: PreferenceSnapshot = {
                ...mockSnapshot,
                revision: 2,
            };

            const changeEvent: PreferenceChangeEvent = {
                type: "updated",
                snapshot: newSnapshot,
                delta: {
                    path: "ui.theme",
                    value: "dark",
                    revision: 1,
                },
            };

            const changeListener = vi.fn();
            preferenceMirror.on("preferenceChanged", changeListener);

            // 模拟文昌服务事件
            eventHandler(changeEvent);

            // 检查镜像状态是否更新
            const state = preferenceMirror.getState();
            expect(state.snapshot).toEqual(newSnapshot);
            expect(state.lastError).toBeNull();

            // 检查事件是否转发
            expect(changeListener).toHaveBeenCalledWith(changeEvent);
        });

        it("应该处理不同类型的变更事件", () => {
            const resetEvent: PreferenceChangeEvent = {
                type: "reset",
                snapshot: mockSnapshot,
            };

            const changeListener = vi.fn();
            preferenceMirror.on("preferenceChanged", changeListener);

            eventHandler(resetEvent);

            expect(changeListener).toHaveBeenCalledWith(resetEvent);
        });
    });

    describe("状态管理", () => {
        it("应该返回当前状态", () => {
            const state = preferenceMirror.getState();

            expect(state).toEqual({
                snapshot: null,
                isLoading: false,
                lastError: null,
            });
        });

        it("应该在加载时更新状态", async () => {
            // 创建一个延迟的Promise来测试加载状态
            let resolvePromise: ((value: any) => void) | undefined;
            const delayedPromise = new Promise((resolve) => {
                resolvePromise = resolve;
            });

            mockInvoke.mockReturnValueOnce(delayedPromise);

            const initPromise = preferenceMirror.initialize();

            // 在初始化过程中检查状态
            const loadingState = preferenceMirror.getState();
            expect(loadingState.isLoading).toBe(true);

            // 完成初始化
            if (resolvePromise) {
                resolvePromise(mockSnapshot);
            }
            await initPromise;

            const finalState = preferenceMirror.getState();
            expect(finalState.isLoading).toBe(false);
            expect(finalState.snapshot).toEqual(mockSnapshot);
        });
    });

    describe("清理和销毁", () => {
        it("应该清理所有资源", async () => {
            mockInvoke.mockResolvedValueOnce(mockSnapshot);
            await preferenceMirror.initialize();

            preferenceMirror.destroy();

            expect(mockRemoveAllListeners).toHaveBeenCalledWith("wenchang.preferenceChanged");

            const state = preferenceMirror.getState();
            expect(state.snapshot).toBeNull();
            expect(state.isLoading).toBe(false);
            expect(state.lastError).toBeNull();
        });
    });

    describe("配置选项", () => {
        it("应该支持自定义配置", () => {
            const customMirror = new PreferenceMirror({
                enableDebugLogging: true,
                retryAttempts: 5,
                retryDelay: 2000,
            });

            expect(customMirror).toBeDefined();
            customMirror.destroy();
        });

        it("应该使用默认配置", () => {
            const defaultMirror = new PreferenceMirror();

            expect(defaultMirror).toBeDefined();
            defaultMirror.destroy();
        });
    });
});
