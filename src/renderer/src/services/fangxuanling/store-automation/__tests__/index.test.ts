/**
 * Store自动同步配置加载器的单元测试
 * 目标：100%代码覆盖率
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadMatterSyncConfig, validateMatterSyncConfig } from "../index";
import type { MatterSyncMetadata } from "../index";
import * as fs from "fs";
import * as path from "path";

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

// Mock fs and path
vi.mock("fs");
vi.mock("path");

describe("store-automation/index", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("loadMatterSyncConfig", () => {
        it("应该成功加载有效的YAML配置", () => {
            const yamlContent = `
metadata:
  version: "1.0.0"
  description: "Test config"
  lastUpdated: "2025-10-12"
  author: "房玄龄"

strategies:
  merge:
    description: "深度合并"
    method: "deepMerge"

matters:
  theme_change:
    snapshotPath: "snapshot"
    syncStrategy: "merge"
    storePath: "preferences"
    autoSync: true
    description: "主题变更"
  language_change:
    snapshotPath: "snapshot"
    syncStrategy: "merge"
    storePath: "preferences"
    autoSync: true
    description: "语言变更"
`;

            vi.mocked(path.join).mockReturnValue("/mock/path/matter-sync.yml");
            vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

            const result = loadMatterSyncConfig();

            expect(result).toHaveProperty("theme_change");
            expect(result).toHaveProperty("language_change");
            expect(result.theme_change.snapshotPath).toBe("snapshot");
            expect(result.language_change.syncStrategy).toBe("merge");
        });

        it("应该在读取文件失败时返回空配置", () => {
            vi.mocked(path.join).mockReturnValue("/mock/path/matter-sync.yml");
            vi.mocked(fs.readFileSync).mockImplementation(() => {
                throw new Error("File not found");
            });

            const result = loadMatterSyncConfig();

            expect(result).toEqual({});
        });

        it("应该在YAML解析失败时返回空配置", () => {
            const invalidYaml = "invalid: yaml: content: [";

            vi.mocked(path.join).mockReturnValue("/mock/path/matter-sync.yml");
            vi.mocked(fs.readFileSync).mockReturnValue(invalidYaml);

            const result = loadMatterSyncConfig();

            expect(result).toEqual({});
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
