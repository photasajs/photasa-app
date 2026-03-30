/**
 * 配置类型适配器
 * 处理旧的PhotasaConfig与新的ConfigManifest之间的转换
 */

import type { PhotasaConfig } from "@photasa/common";
import { normalizeConfigManifest, type ConfigManifest } from "@photasa/sibu";

/**
 * 从旧的PhotasaConfig转换为新的ConfigManifest
 */
export function adaptLegacyConfig(legacyConfig: PhotasaConfig): ConfigManifest {
    // 提取扫描文件夹路径（从photoList推断）
    const scanningFolders = extractUniqueFolders(legacyConfig.photoList?.map((p) => p.path) || []);

    return normalizeConfigManifest({
        // 保留旧版本信息
        overrides: {
            legacyVersion: legacyConfig.version,
            migrationTimestamp: Date.now(),
            legacyPhotoCount: legacyConfig.photoList?.length || 0,
        },
        // 从旧配置推断监控配置
        profiles: scanningFolders.map((folderPath, index) => ({
            id: `profile-${index}`,
            rootPath: folderPath,
            recursive: true,
            ignore: [".DS_Store", "Thumbs.db"],
            paused: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        })),
        // 快照当前扫描的文件夹
        scanningFoldersSnapshot: scanningFolders,
        // 记录迁移历史
        history: [
            {
                revision: "", // 会被normalizer填充
                actor: "config-adapter",
                timestamp: Date.now(),
                summary: `从旧版本${legacyConfig.version}迁移，包含${legacyConfig.photoList?.length || 0}个照片记录`,
            },
        ],
    });
}

/**
 * 从照片路径列表中提取唯一的文件夹路径
 */
function extractUniqueFolders(photoPaths: string[]): string[] {
    const folderSet = new Set<string>();

    for (const photoPath of photoPaths) {
        // 获取文件所在目录
        const folderPath = photoPath.substring(0, photoPath.lastIndexOf("/")) || "/";
        folderSet.add(folderPath);
    }

    // 去重并排序
    return Array.from(folderSet).sort();
}

/**
 * 将新的ConfigManifest转换为兼容的PhotasaConfig（向后兼容）
 */
export function adaptToLegacyConfig(configManifest: ConfigManifest): PhotasaConfig {
    return {
        version: `migrated-${configManifest.revision.substring(0, 8)}`,
        photoList: [], // 新架构中照片列表由FolderManifest管理
        lastModified: configManifest.updatedAt,
    };
}

/**
 * 检查是否为旧版本配置
 */
export function isLegacyConfig(config: any): config is PhotasaConfig {
    return (
        config &&
        typeof config.version === "string" &&
        Array.isArray(config.photoList) &&
        typeof config.lastModified === "number" &&
        !config.revision
    ); // 新版本有revision字段
}

/**
 * 统一配置接口 - 支持新旧两种格式
 */
export type UnifiedConfig = ConfigManifest | PhotasaConfig;

/**
 * 统一配置结果
 */
export interface UnifiedConfigResult {
    configPath: string;
    config: UnifiedConfig;
    isLegacy: boolean;
    migrated?: ConfigManifest; // 如果是旧配置，提供迁移后的版本
}

/**
 * 统一配置适配器
 */
export class ConfigAdapter {
    /**
     * 加载和适配配置
     */
    static adapt(configPath: string, rawConfig: any): UnifiedConfigResult {
        if (isLegacyConfig(rawConfig)) {
            return {
                configPath,
                config: rawConfig,
                isLegacy: true,
                migrated: adaptLegacyConfig(rawConfig),
            };
        } else {
            return {
                configPath,
                config: normalizeConfigManifest(rawConfig),
                isLegacy: false,
            };
        }
    }

    /**
     * 获取配置的统一格式
     */
    static getUnified(result: UnifiedConfigResult): ConfigManifest {
        if (result.isLegacy) {
            if (!result.migrated) {
                throw new Error("Legacy config migration failed");
            }
            return result.migrated;
        }
        return result.config as ConfigManifest;
    }
}
