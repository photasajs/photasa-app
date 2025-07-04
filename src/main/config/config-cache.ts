import type { PhotasaConfig } from "@common/config-types";

/**
 * Cache for config files.
 */
export const configCache = new Map<string, { config: PhotasaConfig; timestamp: number }>();

/**
 * Cache for 5 seconds.
 */
export const CACHE_TTL = 5000;

/**
 * Get the config cache for a folder.
 */
export function getConfigCache(folderPath: string) {
    return configCache.get(folderPath);
}

/**
 * Set the config cache for a folder.
 */
export function setConfigCache(folderPath: string, config: PhotasaConfig) {
    configCache.set(folderPath, { config, timestamp: Date.now() });
}

/**
 * Clear the config cache for a folder.
 */
export function clearConfigCache(folderPath: string) {
    configCache.delete(folderPath);
}

/**
 * Clear all config caches.
 */
export function clearAllConfigCache() {
    configCache.clear();
}
