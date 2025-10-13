/**
 * Store自动同步配置加载器的单元测试
 * 目标：100%代码覆盖率
 *
 * 注意：YAML文件通过import直接加载，无需mock fs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadMatterSyncConfig, validateMatterSyncConfig } from "../index";
import type { MatterSyncMetadata } from "../index";

// Mock logger
vi.mock("@common/logger", () => ({
    loggers: {
        fangxuanling: {
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    },
}));

describe("store-automation/index", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("loadMatterSyncConfig", () => {
        it("应该成功加载真实的YAML配置", () => {
            const result = loadMatterSyncConfig();

            // 验证加载了所有matter配置
            expect(result).toHaveProperty("theme_change");
            expect(result).toHaveProperty("language_change");
            expect(result).toHaveProperty("thumbnail_size_change");
            expect(result).toHaveProperty("add_path");
            expect(result).toHaveProperty("remove_path");
            expect(result).toHaveProperty("add_scan_folder");
            expect(result).toHaveProperty("get_preferences");

            // 验证具体配置内容（基于真实YAML文件）
            expect(result.theme_change.snapshotPath).toBe("data");
            expect(result.theme_change.syncStrategy).toBe("merge");
            expect(result.theme_change.storePath).toBe("preferences");
            expect(result.theme_change.autoSync).toBe(true);

            expect(result.get_preferences.snapshotPath).toBe(".");
            expect(result.get_preferences.syncStrategy).toBe("replace");
        });
    });

    describe("validateMatterSyncConfig", () => {
        it("应该验证有效的配置", () => {
            const validConfig: Record<string, MatterSyncMetadata> = {
                theme_change: {
                    snapshotPath: "snapshot",
                    syncStrategy: "merge",
                    storePath: "preferences",
                    autoSync: true,
                    description: "主题变更",
                },
                language_change: {
                    snapshotPath: "snapshot",
                    syncStrategy: "patch",
                    storePath: "preferences",
                    autoSync: true,
                },
            };

            const result = validateMatterSyncConfig(validConfig);

            expect(result).toBe(true);
        });

        it("应该拒绝空配置", () => {
            const result = validateMatterSyncConfig({});

            expect(result).toBe(false);
        });

        it("应该拒绝null配置", () => {
            const result = validateMatterSyncConfig(
                null as unknown as Record<string, MatterSyncMetadata>,
            );

            expect(result).toBe(false);
        });

        it("应该拒绝缺少snapshotPath的配置", () => {
            const invalidConfig: Record<string, MatterSyncMetadata> = {
                theme_change: {
                    snapshotPath: "",
                    syncStrategy: "merge",
                    storePath: "preferences",
                    autoSync: true,
                },
            };

            const result = validateMatterSyncConfig(invalidConfig);

            expect(result).toBe(false);
        });

        it("应该拒绝缺少syncStrategy的配置", () => {
            const invalidConfig: Record<string, MatterSyncMetadata> = {
                theme_change: {
                    snapshotPath: "snapshot",
                    syncStrategy: "" as "merge",
                    storePath: "preferences",
                    autoSync: true,
                },
            };

            const result = validateMatterSyncConfig(invalidConfig);

            expect(result).toBe(false);
        });

        it("应该拒绝缺少storePath的配置", () => {
            const invalidConfig: Record<string, MatterSyncMetadata> = {
                theme_change: {
                    snapshotPath: "snapshot",
                    syncStrategy: "merge",
                    storePath: "",
                    autoSync: true,
                },
            };

            const result = validateMatterSyncConfig(invalidConfig);

            expect(result).toBe(false);
        });

        it("应该拒绝无效的syncStrategy", () => {
            const invalidConfig: Record<string, MatterSyncMetadata> = {
                theme_change: {
                    snapshotPath: "snapshot",
                    syncStrategy: "invalid" as "merge",
                    storePath: "preferences",
                    autoSync: true,
                },
            };

            const result = validateMatterSyncConfig(invalidConfig);

            expect(result).toBe(false);
        });

        it("应该接受所有有效的syncStrategy", () => {
            const configs = ["merge", "replace", "patch"].map((strategy) => ({
                test_matter: {
                    snapshotPath: "snapshot",
                    syncStrategy: strategy as "merge" | "replace" | "patch",
                    storePath: "preferences",
                    autoSync: true,
                },
            }));

            configs.forEach((config) => {
                const result = validateMatterSyncConfig(config);
                expect(result).toBe(true);
            });
        });
    });
});
