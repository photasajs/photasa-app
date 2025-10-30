/**
 * 房玄龄Store自动同步配置加载器
 *
 * 使用Vite的YAML插件直接导入配置
 * 实现Store自动同步的配置驱动机制
 */

import { loggers } from "@common/logger";
import matterSyncYaml from "./matter-sync.yml";

const logger = loggers.fangxuanling;

// 导出Store注册表相关
export { getStoreByPath, isValidStorePath, extractStoreName } from "./store-registry";
export type { StoreRegistry } from "./store-registry";

/**
 * 奏折matter与Store同步配置接口
 *
 * ✅ RFC 0042 Store Automation修正 (Linus "好品味"设计)：
 * - storeName: 明确是Store名称（Registry键），不是路径
 * - propertyPath: 明确是属性链（Property Chain），双重用途清晰
 *   - 用途1：从天界响应提取数据 (extractSnapshotFromResponse)
 *   - 用途2：向Store写入数据位置 (setStoreFieldData)
 */
export interface MatterSyncMetadata {
    /** Store名称（Store Registry键，如"preferences"、"scanning"） */
    storeName: string;
    /** 属性链（如"queue"、"ui.theme"、"."表示根级别） */
    propertyPath: string;
    /** Store同步策略 */
    syncStrategy: "merge" | "replace";
    /** 是否自动同步 */
    autoSync: boolean;
    /** 配置描述 */
    description?: string;
}

/**
 * 策略配置接口
 */
export interface StrategyConfig {
    description: string;
    method: string;
}

/**
 * 完整配置结构接口
 */
export interface MatterSyncConfig {
    metadata: {
        version: string;
        description: string;
        lastUpdated: string;
        author: string;
    };
    strategies: Record<string, StrategyConfig>;
    matters: Record<string, MatterSyncMetadata>;
    specialRules?: {
        customHandlers: unknown[];
    };
}

/**
 * 加载matter同步配置
 * 房玄龄构造函数中自动调用
 *
 * 使用@rollup/plugin-yaml在构建时将YAML转换为JavaScript对象
 *
 * @returns matter同步配置映射表
 */
export function loadMatterSyncConfig(): Record<string, MatterSyncMetadata> {
    const config = matterSyncYaml as MatterSyncConfig;

    logger.info(
        `📚 朝廷典章加载: v${config.metadata.version}, 配置matters数量: ${Object.keys(config.matters).length}`,
    );

    return config.matters;
}

/**
 * 验证配置有效性
 *
 * @param config 配置对象
 * @returns 是否有效
 */
export function validateMatterSyncConfig(config: Record<string, MatterSyncMetadata>): boolean {
    if (!config || Object.keys(config).length === 0) {
        logger.warn("⚠️ 典章空缺，自动同步功能将被禁用");
        return false;
    }

    // 验证每个matter配置的必需字段
    for (const [matter, metadata] of Object.entries(config)) {
        if (!metadata.propertyPath || !metadata.syncStrategy || !metadata.storeName) {
            logger.error(`❌ matter配置不完整: ${matter}`, metadata);
            return false;
        }

        if (!["merge", "replace", "patch"].includes(metadata.syncStrategy)) {
            logger.error(`❌ 无效的同步策略: ${metadata.syncStrategy} (matter: ${matter})`);
            return false;
        }
    }

    logger.info("📚 典章验证通过");
    return true;
}
