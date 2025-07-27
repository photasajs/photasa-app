/**
 * Import Wizard Helper Functions
 *
 * This module contains pure functions for handling import wizard logic,
 * including validation, data transformation, and configuration management.
 */

import type { ImportConfig, DuplicateStrategy, ImportFilters } from "@common/import-types";
import { createDefaultFilters } from "./import-helpers";

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
 * @returns Configuration data object
 */
export function createInitialConfigurationData(
    initialSourcePaths: string[] = [],
    initialTargetPath = "",
    defaultPaths: string[] = [],
): {
    sourcePaths: string[];
    targetPath: string;
    filters: ImportFilters;
    duplicateStrategy: DuplicateStrategy;
} {
    return {
        sourcePaths: Array.isArray(initialSourcePaths) ? [...initialSourcePaths] : [],
        targetPath: initialTargetPath || defaultPaths[0] || "",
        filters: createDefaultFilters(),
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
 * Creates an ImportConfig object for preview API call
 * @param configData - Configuration step data
 * @returns ImportConfig object for API call
 */
export function createPreviewConfig(configData: any): ImportConfig {
    return {
        sourcePaths: configData.sourcePaths || [],
        targetPath: configData.targetPath || "",
        filters: configData.filters || createDefaultFilters(),
        duplicateStrategy: configData.duplicateStrategy || "rename",
        fileGroups: [],
        selectedFiles: [],
        allowDuplicateRename: true,
    };
}
