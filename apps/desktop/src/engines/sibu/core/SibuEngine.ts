import type { PhotasaConfig } from "@common/config-types";
import type { PhotasaLogger } from "@common/logger";
import type { ConfigManifest, FolderManifest } from "../types/manifests";
import { ManifestStore } from "../services/ManifestStore";
import { ManifestCache } from "../services/ManifestCache";
import {
    createEmptyConfigManifest,
    createEmptyFolderManifest,
    normalizeFolderManifest,
} from "../support/manifest-normalizer";
import { ConfigAdapter, type UnifiedConfig } from "../adapters/config-adapter";

export interface SibuEngineOptions {
    cacheTtlMs?: number;
    store?: ManifestStore;
    cache?: ManifestCache;
    enableLegacySupport?: boolean; // 是否启用旧版本兼容
}

// 向后兼容的结果类型
export interface SibuManifestResult {
    configPath: string;
    manifest: PhotasaConfig;
}

// 新的统一结果类型
export interface SibuUnifiedResult {
    configPath: string;
    config: UnifiedConfig;
    isLegacy: boolean;
    migrated?: ConfigManifest;
}

// 新的配置清单结果类型
export interface SibuConfigResult {
    configPath: string;
    manifest: ConfigManifest;
}

// 文件夹清单结果类型
export interface SibuFolderResult {
    manifestPath: string;
    manifest: FolderManifest;
}

export class SibuEngine {
    private readonly store: ManifestStore;
    private readonly cache: ManifestCache;
    private readonly enableLegacySupport: boolean;

    constructor(options: SibuEngineOptions = {}) {
        this.store = options.store ?? new ManifestStore();
        this.cache = options.cache ?? new ManifestCache({ ttlMs: options.cacheTtlMs ?? 5_000 });
        this.enableLegacySupport = options.enableLegacySupport ?? true;
    }

    // === 新的API方法 ===

    /**
     * 加载配置清单（新架构）
     */
    async loadConfigManifest(configPath: string, logger: PhotasaLogger): Promise<SibuConfigResult> {
        const unifiedResult = await this.loadUnifiedConfig(configPath, logger);
        const manifest = ConfigAdapter.getUnified(unifiedResult);

        return {
            configPath,
            manifest,
        };
    }

    /**
     * 加载文件夹清单
     */
    async loadFolderManifest(folderPath: string, logger: PhotasaLogger): Promise<SibuFolderResult> {
        const manifestPath = this.store.resolveManifestPath(folderPath, false);

        try {
            const rawManifest = await this.store.readManifest(manifestPath, logger);
            const manifest = normalizeFolderManifest(rawManifest as any, logger);

            return {
                manifestPath,
                manifest,
            };
        } catch {
            // 如果文件夹清单不存在，创建一个空的
            const manifest = createEmptyFolderManifest(folderPath);
            await this.store.writeManifest(manifestPath, manifest as any, logger);

            return {
                manifestPath,
                manifest,
            };
        }
    }

    /**
     * 写入配置清单
     */
    async writeConfigManifest(
        configPath: string,
        manifest: ConfigManifest,
        logger: PhotasaLogger,
    ): Promise<void> {
        await this.store.writeManifest(configPath, manifest as any, logger);
        this.cache.set(configPath, manifest as any);
    }

    /**
     * 写入文件夹清单
     */
    async writeFolderManifest(
        manifestPath: string,
        manifest: FolderManifest,
        logger: PhotasaLogger,
    ): Promise<void> {
        await this.store.writeManifest(manifestPath, manifest as any, logger);
    }

    /**
     * 加载统一配置（支持新旧格式）
     */
    async loadUnifiedConfig(configPath: string, logger: PhotasaLogger): Promise<SibuUnifiedResult> {
        const cached = this.cache.get(configPath);
        if (cached) {
            const adapted = ConfigAdapter.adapt(configPath, cached);
            return {
                configPath,
                config: adapted.config,
                isLegacy: adapted.isLegacy,
                migrated: adapted.migrated,
            };
        }

        const rawConfig = await this.store.readManifest(configPath, logger);
        const adapted = ConfigAdapter.adapt(configPath, rawConfig);

        this.cache.set(configPath, rawConfig);

        return {
            configPath,
            config: adapted.config,
            isLegacy: adapted.isLegacy,
            migrated: adapted.migrated,
        };
    }

    // === 向后兼容的API方法 ===

    async loadManifestForTarget(
        targetPath: string,
        isFile: boolean,
        logger: PhotasaLogger,
    ): Promise<SibuManifestResult> {
        const configPath = await this.store.ensureManifest(targetPath, isFile, logger);
        return this.loadManifest(configPath, logger);
    }

    async loadManifest(configPath: string, logger: PhotasaLogger): Promise<SibuManifestResult> {
        if (this.enableLegacySupport) {
            const unifiedResult = await this.loadUnifiedConfig(configPath, logger);

            if (unifiedResult.isLegacy) {
                return {
                    configPath,
                    manifest: unifiedResult.config as PhotasaConfig,
                };
            } else {
                // 将新格式转换为旧格式以保持兼容性
                return {
                    configPath,
                    manifest: unifiedResult.config as PhotasaConfig,
                };
            }
        }

        // 非兼容模式下，使用原有逻辑
        const cached = this.cache.get(configPath);
        if (cached) {
            return { configPath, manifest: cached };
        }

        const manifest = await this.store.readManifest(configPath, logger);
        this.cache.set(configPath, manifest);
        return { configPath, manifest };
    }

    async writeManifest(
        configPath: string,
        manifest: PhotasaConfig,
        logger: PhotasaLogger,
    ): Promise<void> {
        await this.store.writeManifest(configPath, manifest, logger);
        this.cache.set(configPath, manifest);
    }

    async writeEmptyManifest(configPath: string, logger: PhotasaLogger): Promise<void> {
        await this.writeManifest(configPath, createEmptyConfigManifest() as any, logger);
    }

    // === 通用方法 ===

    clearCache(): void {
        this.cache.clear();
    }

    primeCache(configPath: string, manifest: PhotasaConfig): void {
        this.cache.set(configPath, manifest);
    }

    /**
     * 验证路径合法性
     */
    async validatePath(path: string): Promise<{ valid: boolean; reason?: string }> {
        try {
            const fs = await import("fs/promises");
            const stat = await fs.stat(path);

            if (!stat.isDirectory() && !stat.isFile()) {
                return { valid: false, reason: "路径既不是文件也不是目录" };
            }

            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                reason: `路径访问失败: ${error instanceof Error ? error.message : "未知错误"}`,
            };
        }
    }

    /**
     * 获取引擎状态（供承宣层调用）
     */
    getEngineStatus() {
        return {
            isLoading: false, // TODO: 实现加载状态跟踪
            currentOperation: undefined,
            loadProgress: 0,
            cacheSize: this.cache.getSize(),
            enabledFeatures: {
                legacySupport: this.enableLegacySupport,
            },
        };
    }
}
