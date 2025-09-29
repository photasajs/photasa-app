/**
 * 文昌服务测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { promises as fs } from "fs";
import { WenchangService } from "../core/WenchangService";
import type { WenchangConfig, PreferenceDelta } from "../types";

describe("WenchangService", () => {
    let wenchangService: WenchangService;
    let testStoragePath: string;
    let config: WenchangConfig;

    beforeEach(async () => {
        // 创建临时测试目录
        testStoragePath = join(tmpdir(), `wenchang-test-${Date.now()}`);

        config = {
            storagePath: testStoragePath,
            enableHistory: true,
            maxHistorySize: 100,
            enableHotReload: false, // 测试时禁用热重载
            syncInterval: 1000,
        };

        wenchangService = new WenchangService(config);
    });

    afterEach(async () => {
        await wenchangService.shutdown();

        // 清理测试目录
        try {
            await fs.rmdir(testStoragePath, { recursive: true });
        } catch (error) {
            // 忽略清理错误
        }
    });

    describe("初始化", () => {
        it("应该创建默认偏好配置", async () => {
            await wenchangService.initialize();

            const snapshot = wenchangService.getCurrentSnapshot();

            expect(snapshot).toBeDefined();
            expect(snapshot.revision).toBe(1);
            expect(snapshot.data.ui.theme).toBe("auto");
            expect(snapshot.data.display.thumbnailSize).toBe(200);
            expect(snapshot.data.scanning.autoScan).toBe(true);
        });

        it("应该创建存储目录", async () => {
            await wenchangService.initialize();

            const stats = await fs.stat(testStoragePath);
            expect(stats.isDirectory()).toBe(true);
        });

        it("应该保存偏好文件", async () => {
            await wenchangService.initialize();

            const preferencesFile = join(testStoragePath, "preferences.json");
            const stats = await fs.stat(preferencesFile);
            expect(stats.isFile()).toBe(true);
        });
    });

    describe("偏好变更", () => {
        beforeEach(async () => {
            await wenchangService.initialize();
        });

        it("应该应用简单的偏好变更", async () => {
            const initialSnapshot = wenchangService.getCurrentSnapshot();

            const delta: PreferenceDelta = {
                path: "ui.theme",
                value: "dark",
                revision: initialSnapshot.revision,
            };

            const newRevision = await wenchangService.applyDelta(delta);

            expect(newRevision).toBe(initialSnapshot.revision + 1);

            const newSnapshot = wenchangService.getCurrentSnapshot();
            expect(newSnapshot.data.ui.theme).toBe("dark");
            expect(newSnapshot.revision).toBe(newRevision);
        });

        it("应该应用嵌套属性变更", async () => {
            const initialSnapshot = wenchangService.getCurrentSnapshot();

            const delta: PreferenceDelta = {
                path: "display.thumbnailSize",
                value: 300,
                revision: initialSnapshot.revision,
            };

            await wenchangService.applyDelta(delta);

            const newSnapshot = wenchangService.getCurrentSnapshot();
            expect(newSnapshot.data.display.thumbnailSize).toBe(300);
        });

        it("应该检测版本冲突", async () => {
            const delta: PreferenceDelta = {
                path: "ui.theme",
                value: "dark",
                revision: 999, // 错误的版本号
            };

            await expect(wenchangService.applyDelta(delta)).rejects.toThrow("Version conflict");
        });

        it("应该触发变更事件", async () => {
            const initialSnapshot = wenchangService.getCurrentSnapshot();

            const changeListener = vi.fn();
            wenchangService.on("preferenceChanged", changeListener);

            const delta: PreferenceDelta = {
                path: "ui.theme",
                value: "dark",
                revision: initialSnapshot.revision,
            };

            await wenchangService.applyDelta(delta);

            expect(changeListener).toHaveBeenCalledWith({
                type: "updated",
                snapshot: expect.objectContaining({
                    revision: initialSnapshot.revision + 1,
                }),
                delta,
            });
        });
    });

    describe("历史记录", () => {
        beforeEach(async () => {
            await wenchangService.initialize();
        });

        it("应该记录偏好变更历史", async () => {
            const initialSnapshot = wenchangService.getCurrentSnapshot();

            const delta: PreferenceDelta = {
                path: "ui.theme",
                value: "dark",
                revision: initialSnapshot.revision,
            };

            await wenchangService.applyDelta(delta);

            const history = wenchangService.getHistory();
            expect(history).toHaveLength(1);
            expect(history[0].delta).toEqual(delta);
            expect(history[0].source).toBe("user");
        });

        it("应该限制历史记录大小", async () => {
            // 设置小的历史记录限制
            const smallConfig = { ...config, maxHistorySize: 2 };
            const smallWenchang = new WenchangService(smallConfig);
            await smallWenchang.initialize();

            let currentRevision = smallWenchang.getCurrentSnapshot().revision;

            // 创建3个变更
            for (let i = 0; i < 3; i++) {
                const delta: PreferenceDelta = {
                    path: "ui.theme",
                    value: i % 2 === 0 ? "dark" : "light",
                    revision: currentRevision,
                };

                currentRevision = await smallWenchang.applyDelta(delta);
            }

            const history = smallWenchang.getHistory();
            expect(history).toHaveLength(2); // 应该只保留最后2个

            await smallWenchang.shutdown();
        });
    });

    describe("重置和导入", () => {
        beforeEach(async () => {
            await wenchangService.initialize();
        });

        it("应该重置到默认值", async () => {
            // 先修改一些值
            const delta: PreferenceDelta = {
                path: "ui.theme",
                value: "dark",
                revision: wenchangService.getCurrentSnapshot().revision,
            };
            await wenchangService.applyDelta(delta);

            // 然后重置
            const resetSnapshot = await wenchangService.resetToDefaults();

            expect(resetSnapshot.data.ui.theme).toBe("auto"); // 回到默认值
            expect(resetSnapshot.revision).toBeGreaterThan(1);
        });

        it("应该导入部分偏好配置", async () => {
            const partialPrefs = {
                ui: {
                    theme: "dark" as const,
                    language: "en-US",
                },
                display: {
                    thumbnailSize: 400,
                },
            };

            const importedSnapshot = await wenchangService.importPreferences(partialPrefs);

            expect(importedSnapshot.data.ui.theme).toBe("dark");
            expect(importedSnapshot.data.ui.language).toBe("en-US");
            expect(importedSnapshot.data.display.thumbnailSize).toBe(400);
            // 其他值应该保持默认
            expect(importedSnapshot.data.scanning.autoScan).toBe(true);
        });
    });

    describe("持久化", () => {
        it("应该从已存在的文件加载偏好", async () => {
            // 先创建一个偏好文件
            await wenchangService.initialize();

            const delta: PreferenceDelta = {
                path: "ui.theme",
                value: "dark",
                revision: wenchangService.getCurrentSnapshot().revision,
            };
            await wenchangService.applyDelta(delta);
            await wenchangService.shutdown();

            // 创建新的服务实例，应该加载之前的配置
            const newWenchangService = new WenchangService(config);
            await newWenchangService.initialize();

            const snapshot = newWenchangService.getCurrentSnapshot();
            expect(snapshot.data.ui.theme).toBe("dark");

            await newWenchangService.shutdown();
        });
    });
});
