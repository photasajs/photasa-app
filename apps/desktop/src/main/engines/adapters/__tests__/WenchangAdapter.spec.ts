import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { WenchangAdapter } from "@photasa/wenchang";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// 创建临时测试目录
const createTempDir = async (): Promise<string> => {
    const tempDir = path.join(os.tmpdir(), `wenchang-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
};

// 清理临时目录
const cleanupTempDir = async (tempDir: string): Promise<void> => {
    try {
        await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
        // 忽略清理错误
    }
};

describe("WenchangAdapter", () => {
    let adapter: WenchangAdapter;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await createTempDir();
        adapter = new WenchangAdapter({
            customPreferencesDir: tempDir,
            autoSaveInterval: 100, // 快速保存用于测试
        });
    });

    afterEach(async () => {
        if (adapter) {
            await adapter.shutdown();
        }
        await cleanupTempDir(tempDir);
    });

    describe("initialization", () => {
        it("should initialize successfully", async () => {
            await expect(adapter.initialize()).resolves.not.toThrow();
            expect(adapter.isReady()).toBe(true);
        });

        it("should have correct adapter name", () => {
            expect(adapter.name).toBe("wenchang");
        });
    });

    describe("preference management", () => {
        beforeEach(async () => {
            await adapter.initialize();
        });

        it("should get current snapshot with default preferences", () => {
            const snapshot = adapter.getCurrentSnapshot();

            expect(snapshot).toHaveProperty("data");
            expect(snapshot).toHaveProperty("timestamp");
            expect(snapshot).toHaveProperty("revision");
            expect(snapshot.data.ui.theme).toBe("solarized-dark");
            expect(snapshot.data.display.thumbnailSize).toBe(150);
        });

        it("should apply preference delta and return new revision", async () => {
            const oldRevision = adapter.getRevision();

            const delta = {
                ui: { theme: "dark" },
                display: { thumbnailSize: 300 },
            };

            const newRevision = await adapter.applyDelta(delta, "test");

            expect(newRevision).toBeGreaterThan(oldRevision);

            const snapshot = adapter.getCurrentSnapshot();
            expect(snapshot.data.ui.theme).toBe("dark");
            expect(snapshot.data.display.thumbnailSize).toBe(300);
        });

        it("should reset preferences to defaults", async () => {
            // 先修改一些偏好
            await adapter.applyDelta({
                ui: { theme: "dark" },
                display: { thumbnailSize: 500 },
            });

            // 重置到默认值
            const snapshot = await adapter.resetToDefaults();

            expect(snapshot.data.ui.theme).toBe("solarized-dark");
            expect(snapshot.data.display.thumbnailSize).toBe(150);
        });

        it("should persist preferences to file", async () => {
            const delta = {
                ui: { theme: "dark" },
                display: { sortOrder: "name" as const },
            };

            await adapter.applyDelta(delta);
            await adapter.savePreferences();

            // 验证文件是否存在
            const preferencesFile = path.join(tempDir, "preferences.json");
            const fileExists = await fs
                .access(preferencesFile)
                .then(() => true)
                .catch(() => false);
            expect(fileExists).toBe(true);

            // 验证文件内容
            const content = await fs.readFile(preferencesFile, "utf-8");
            const preferences = JSON.parse(content);
            expect(preferences.ui.theme).toBe("dark");
            expect(preferences.display.sortOrder).toBe("name");
        });

        it("should load preferences from existing file", async () => {
            // 创建一个偏好文件
            const testPreferences = {
                revision: 5,
                ui: { theme: "light", layout: "list", language: "en-US" },
                display: { thumbnailSize: 150, sortOrder: "sizeDesc", groupBy: "type" },
                scanning: { autoScan: false, excludePatterns: ["*.log"], concurrency: 2 },
                lastModified: Date.now(),
            };

            const preferencesFile = path.join(tempDir, "preferences.json");
            await fs.writeFile(preferencesFile, JSON.stringify(testPreferences, null, 2));

            // 创建新的适配器实例来加载现有偏好
            const newAdapter = new WenchangAdapter({
                customPreferencesDir: tempDir,
            });

            await newAdapter.initialize();

            const snapshot = newAdapter.getCurrentSnapshot();
            expect(snapshot.data.ui.theme).toBe("light");
            expect(snapshot.data.display.thumbnailSize).toBe(150);
            expect(snapshot.data.scanning.autoScan).toBe(false);
            expect(snapshot.revision).toBe(5);

            await newAdapter.shutdown();
        });
    });

    describe("event handling", () => {
        beforeEach(async () => {
            await adapter.initialize();
        });

        it("should emit preference change events", async () => {
            const changeHandler = jest.fn();
            adapter.onPreferenceChanged(changeHandler);

            const delta = { ui: { theme: "dark" } };
            await adapter.applyDelta(delta, "test");

            expect(changeHandler).toHaveBeenCalled();
            const event = changeHandler.mock.calls[0][0] as any;
            expect(event.type).toBe("updated");
            expect(event.delta).toEqual(delta);
        });

        it("should remove event listeners", async () => {
            const changeHandler = jest.fn();
            adapter.onPreferenceChanged(changeHandler);
            adapter.offPreferenceChanged(changeHandler);

            await adapter.applyDelta({ ui: { theme: "dark" } });

            expect(changeHandler).not.toHaveBeenCalled();
        });
    });

    describe("path operations (新架构 - 通过applyDelta)", () => {
        beforeEach(async () => {
            await adapter.initialize();
        });

        it("should apply paths delta successfully", async () => {
            const testPath = path.join(tempDir, "test-path");

            // ✅ 新架构：业务逻辑在FangXuanLing，WenchangEngine只接收完整状态
            const result = await adapter.updatePreferences({
                delta: {
                    scanning: {
                        paths: [testPath], // 完整的新paths数组
                    },
                },
            });

            expect(result.result.success).toBe(true);
            expect(result.result.revision).toBeGreaterThan(0);

            const snapshot = adapter.getCurrentSnapshot();
            expect(snapshot.data.scanning.paths).toContain(testPath);
        });

        it("should remove path via delta successfully", async () => {
            const testPath1 = path.join(tempDir, "test-path-1");
            const testPath2 = path.join(tempDir, "test-path-2");

            // 先添加两个路径
            await adapter.updatePreferences({
                delta: {
                    scanning: {
                        paths: [testPath1, testPath2],
                    },
                },
            });

            // 移除一个路径（通过发送新的完整数组）
            const result = await adapter.updatePreferences({
                delta: {
                    scanning: {
                        paths: [testPath1], // 只保留testPath1
                    },
                },
            });

            expect(result.result.success).toBe(true);

            const snapshot = adapter.getCurrentSnapshot();
            expect(snapshot.data.scanning.paths).toContain(testPath1);
            expect(snapshot.data.scanning.paths).not.toContain(testPath2);
        });

        it("should handle empty paths array", async () => {
            // 测试空数组
            const result = await adapter.updatePreferences({
                delta: {
                    scanning: {
                        paths: [],
                    },
                },
            });

            expect(result.result.success).toBe(true);

            const snapshot = adapter.getCurrentSnapshot();
            expect(snapshot.data.scanning.paths).toEqual([]);
        });
    });

    describe("shutdown", () => {
        it("should shutdown gracefully", async () => {
            await adapter.initialize();
            await expect(adapter.shutdown()).resolves.not.toThrow();
            expect(adapter.isReady()).toBe(false);
        });
    });
});
