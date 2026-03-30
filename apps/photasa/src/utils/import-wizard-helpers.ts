/**
 * Import Wizard Helper Functions
 *
 * This module contains pure functions for handling import wizard logic,
 * including validation, data transformation, and configuration management.
 */

import type { ImportConfig, DuplicateStrategy, ImportFilters } from "@photasa/common";
import { createDefaultFilters } from "./import-helpers";
import { getLogger } from "@photasa/common";

const logger = getLogger("import-wizard-helpers");

/**
 * Validates if the configuration step has the minimum required data
 * @param configData - Configuration step data
 * @returns true if configuration is valid, false otherwise
 */
export function validateConfigurationStep(configData: any): boolean {
    if (!configData) return false;

    // Must have at least one source path
    if (
        !configData.sourcePaths ||
        !Array.isArray(configData.sourcePaths) ||
        configData.sourcePaths.length === 0
    ) {
        return false;
    }

    // Must have a target path
    if (
        !configData.targetPath ||
        typeof configData.targetPath !== "string" ||
        configData.targetPath.trim() === ""
    ) {
        return false;
    }

    return true;
}

/**
 * Validates if the preview step has the minimum required data
 * @param previewData - Preview step data
 * @returns true if preview is valid, false otherwise
 */
export function validatePreviewStep(previewData: any): boolean {
    if (!previewData) return false;

    // Must have selected files
    if (!previewData.selectedFiles || previewData.selectedFiles.size === 0) {
        return false;
    }

    return true;
}

/**
 * Creates initial configuration data with default values
 * @param initialSourcePaths - Initial source paths (optional)
 * @param initialTargetPath - Initial target path (optional)
 * @param defaultPaths - Default paths from store
 * @param excludePaths - Exclude paths from preference store
 * @returns Configuration data object
 */
export function createInitialConfigurationData(
    initialSourcePaths: string[] = [],
    initialTargetPath = "",
    defaultPaths: string[] = [],
    excludePaths?: string[],
): {
    sourcePaths: string[];
    targetPath: string;
    filters: ImportFilters;
    duplicateStrategy: DuplicateStrategy;
} {
    return {
        sourcePaths: Array.isArray(initialSourcePaths) ? [...initialSourcePaths] : [],
        targetPath: initialTargetPath || defaultPaths[0] || "",
        filters: createDefaultFilters(excludePaths),
        duplicateStrategy: "rename" as DuplicateStrategy,
    };
}

/**
 * Creates initial preview data with empty values
 * @returns Preview data object
 */
export function createInitialPreviewData(): {
    files: any[];
    selectedFiles: Set<string>;
    totalCount: number;
    totalSize: number;
    statistics: {
        imageFiles: number;
        videoFiles: number;
        otherFiles: number;
        duplicateCount: number;
    };
} {
    return {
        files: [],
        selectedFiles: new Set(),
        totalCount: 0,
        totalSize: 0,
        statistics: {
            imageFiles: 0,
            videoFiles: 0,
            otherFiles: 0,
            duplicateCount: 0,
        },
    };
}

/**
 * Transforms configuration data into ImportConfig format
 * @param configData - Configuration step data
 * @param previewData - Preview step data
 * @returns ImportConfig object
 */
export function transformToImportConfig(configData: any, previewData: any): ImportConfig {
    return {
        sourcePaths: configData.sourcePaths || [],
        targetPath: configData.targetPath || "",
        filters: configData.filters || createDefaultFilters(),
        duplicateStrategy: configData.duplicateStrategy || "rename",
        fileGroups: previewData.files || [],
        selectedFiles: Array.from(previewData.selectedFiles || []),
        allowDuplicateRename: true,
    };
}

/**
 * Transforms preview API response into preview step data
 * @param previewResponse - Response from previewImport API
 * @returns Preview step data object
 */
export function transformPreviewResponse(previewResponse: any): {
    files: any[];
    selectedFiles: Set<string>;
    totalCount: number;
    totalSize: number;
    statistics: any;
} {
    // 确保previewResponse是一个对象，并且包含预期的属性
    return {
        files: previewResponse.fileGroups || [],
        selectedFiles: new Set(previewResponse.fileGroups?.map((g: any) => g.mainFile.path) || []),
        totalCount: previewResponse.statistics?.totalFiles || 0,
        totalSize: previewResponse.statistics?.totalSize || 0,
        statistics: previewResponse.statistics || {
            imageFiles: 0,
            videoFiles: 0,
            otherFiles: 0,
            duplicateCount: 0,
        },
    };
}

/**
 * Creates a serializable ImportConfig object for IPC API calls
 *
 * 关键修复：确保所有传递给API的数据都是可序列化的，特别是Date对象需要转换为字符串
 * 这解决了"An object could not be cloned"的IPC序列化错误
 *
 * @param configData - Configuration step data
 * @returns ImportConfig object for API call (fully serializable)
 */
export function createSerializableConfig(configData: any, isPreviewOnly = true): ImportConfig {
    /**
     * 深度序列化数据，确保没有任何不可序列化的对象（Date、Set、Function等）
     * 这是解决IPC "An object could not be cloned" 错误的关键步骤
     */

    // 首先对整个configData进行JSON序列化/反序列化，移除所有不可序列化的对象
    let cleanConfigData;
    try {
        cleanConfigData = JSON.parse(JSON.stringify(configData));
    } catch (error) {
        logger.warn("Config data contains non-serializable objects, using defaults:", error);
        cleanConfigData = {};
    }

    // 获取过滤器，如果JSON序列化移除了Date对象，则重新创建
    // 保留原有的excludePaths，这是从store配置中传递过来的
    const originalFilters =
        cleanConfigData.filters || createDefaultFilters(cleanConfigData.filters?.excludePaths);

    // 创建完全可序列化的过滤器对象
    const serializableFilters = {
        fileTypes: Array.isArray(originalFilters.fileTypes)
            ? originalFilters.fileTypes
            : ["image", "video"],
        sizeRange: originalFilters.sizeRange || { min: 0, max: Number.MAX_SAFE_INTEGER },
        // 确保dateRange是字符串格式，适合IPC传输
        dateRange: {
            start:
                typeof originalFilters.dateRange?.start === "string"
                    ? originalFilters.dateRange.start
                    : new Date(0).toISOString(),
            end:
                typeof originalFilters.dateRange?.end === "string"
                    ? originalFilters.dateRange.end
                    : new Date().toISOString(),
        },
        includeSubfolders: originalFilters.includeSubfolders ?? true,
        // 使用来自配置的排除路径，由store管理
        excludePaths: Array.isArray(originalFilters.excludePaths)
            ? originalFilters.excludePaths
            : [], // 如果没有配置，使用空数组
    };

    // 创建完全可序列化的配置对象
    const config = {
        sourcePaths: Array.isArray(cleanConfigData.sourcePaths) ? cleanConfigData.sourcePaths : [],
        targetPath:
            typeof cleanConfigData.targetPath === "string" ? cleanConfigData.targetPath : "",
        filters: serializableFilters,
        duplicateStrategy: cleanConfigData.duplicateStrategy || "rename",
        fileGroups: isPreviewOnly ? [] : cleanConfigData.fileGroups || [],
        selectedFiles: isPreviewOnly
            ? []
            : Array.isArray(cleanConfigData.selectedFiles)
              ? cleanConfigData.selectedFiles
              : [],
        allowDuplicateRename: cleanConfigData.allowDuplicateRename ?? true,
    };

    // 最终验证：再次序列化确保完全可序列化
    try {
        JSON.stringify(config);
        return config;
    } catch (error) {
        logger.error("Config still contains non-serializable data:", error);
        throw new Error("Failed to create serializable configuration");
    }
}

/**
 * Alias for backward compatibility
 * @deprecated Use createSerializableConfig instead
 */
export const createPreviewConfig = createSerializableConfig;
