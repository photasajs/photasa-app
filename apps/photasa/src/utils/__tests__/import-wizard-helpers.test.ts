/**
 * Unit tests for import wizard helper functions
 */

import { describe, it, expect } from "vitest";
import {
    validateConfigurationStep,
    validatePreviewStep,
    createInitialConfigurationData,
    createInitialPreviewData,
    transformToImportConfig,
    transformPreviewResponse,
    createPreviewConfig,
} from "../import-wizard-helpers";

describe("import-wizard-helpers", () => {
    describe("validateConfigurationStep", () => {
        it("should return false for null/undefined data", () => {
            expect(validateConfigurationStep(null)).toBe(false);
            expect(validateConfigurationStep(undefined)).toBe(false);
        });

        it("should return false for empty or invalid sourcePaths", () => {
            expect(validateConfigurationStep({})).toBe(false);
            expect(validateConfigurationStep({ sourcePaths: [] })).toBe(false);
            expect(validateConfigurationStep({ sourcePaths: null })).toBe(false);
            expect(validateConfigurationStep({ sourcePaths: "not-array" })).toBe(false);
        });

        it("should return false for empty or invalid targetPath", () => {
            expect(
                validateConfigurationStep({
                    sourcePaths: ["/path1"],
                }),
            ).toBe(false);

            expect(
                validateConfigurationStep({
                    sourcePaths: ["/path1"],
                    targetPath: "",
                }),
            ).toBe(false);

            expect(
                validateConfigurationStep({
                    sourcePaths: ["/path1"],
                    targetPath: "   ",
                }),
            ).toBe(false);

            expect(
                validateConfigurationStep({
                    sourcePaths: ["/path1"],
                    targetPath: null,
                }),
            ).toBe(false);
        });

        it("should return true for valid configuration", () => {
            expect(
                validateConfigurationStep({
                    sourcePaths: ["/source1", "/source2"],
                    targetPath: "/target",
                }),
            ).toBe(true);
        });
    });

    describe("validatePreviewStep", () => {
        it("should return false for null/undefined data", () => {
            expect(validatePreviewStep(null)).toBe(false);
            expect(validatePreviewStep(undefined)).toBe(false);
        });

        it("should return false for empty selectedFiles", () => {
            expect(validatePreviewStep({})).toBe(false);
            expect(validatePreviewStep({ selectedFiles: null })).toBe(false);
            expect(validatePreviewStep({ selectedFiles: new Set() })).toBe(false);
        });

        it("should return true for valid preview data", () => {
            const selectedFiles = new Set(["file1.jpg", "file2.jpg"]);
            expect(validatePreviewStep({ selectedFiles })).toBe(true);
        });
    });

    describe("createInitialConfigurationData", () => {
        it("should create default configuration with empty arrays", () => {
            const result = createInitialConfigurationData();

            expect(result.sourcePaths).toEqual([]);
            expect(result.targetPath).toBe("");
            expect(result.duplicateStrategy).toBe("rename");
            expect(result.filters).toBeDefined();
        });

        it("should use provided initial values", () => {
            const sourcePaths = ["/source1", "/source2"];
            const targetPath = "/target";
            const defaultPaths = ["/default1", "/default2"];

            const result = createInitialConfigurationData(sourcePaths, targetPath, defaultPaths);

            expect(result.sourcePaths).toEqual(sourcePaths);
            expect(result.targetPath).toBe(targetPath);
        });

        it("should use default path when no target path provided", () => {
            const defaultPaths = ["/default1", "/default2"];

            const result = createInitialConfigurationData([], "", defaultPaths);

            expect(result.targetPath).toBe("/default1");
        });

        it("should prefer import defaults over watched folders", () => {
            const result = createInitialConfigurationData(["/source"], "", ["/watched"], [], {
                defaultTargetPath: "/imports",
                duplicateStrategy: "skip",
                includeSubfolders: false,
            });

            expect(result.targetPath).toBe("/imports");
            expect(result.duplicateStrategy).toBe("skip");
            expect(result.filters.includeSubfolders).toBe(false);
        });

        it("should handle invalid initial source paths", () => {
            const result = createInitialConfigurationData("not-array" as any);

            expect(result.sourcePaths).toEqual([]);
        });
    });

    describe("createInitialPreviewData", () => {
        it("should create empty preview data structure", () => {
            const result = createInitialPreviewData();

            expect(result.files).toEqual([]);
            expect(result.selectedFiles).toBeInstanceOf(Set);
            expect(result.selectedFiles.size).toBe(0);
            expect(result.totalCount).toBe(0);
            expect(result.totalSize).toBe(0);
            expect(result.statistics).toEqual({
                imageFiles: 0,
                videoFiles: 0,
                otherFiles: 0,
                duplicateCount: 0,
            });
        });
    });

    describe("transformToImportConfig", () => {
        it("should transform wizard data to import config", () => {
            const configData = {
                sourcePaths: ["/source1"],
                targetPath: "/target",
                filters: { fileTypes: ["image"] },
                duplicateStrategy: "skip",
            };

            const previewData = {
                files: [{ name: "file1.jpg" }],
                selectedFiles: new Set(["file1.jpg"]),
            };

            const result = transformToImportConfig(configData, previewData);

            expect(result.sourcePaths).toEqual(["/source1"]);
            expect(result.targetPath).toBe("/target");
            expect(result.filters).toEqual({ fileTypes: ["image"] });
            expect(result.duplicateStrategy).toBe("skip");
            expect(result.fileGroups).toEqual([{ name: "file1.jpg" }]);
            expect(result.selectedFiles).toEqual(["file1.jpg"]);
            expect(result.allowDuplicateRename).toBe(true);
        });

        it("should handle missing data with defaults", () => {
            const result = transformToImportConfig({}, {});

            expect(result.sourcePaths).toEqual([]);
            expect(result.targetPath).toBe("");
            expect(result.duplicateStrategy).toBe("rename");
            expect(result.fileGroups).toEqual([]);
            expect(result.selectedFiles).toEqual([]);
        });
    });

    describe("transformPreviewResponse", () => {
        it("should transform API response to preview data", () => {
            const apiResponse = {
                fileGroups: [
                    { mainFile: { path: "file1.jpg" } },
                    { mainFile: { path: "file2.jpg" } },
                ],
                statistics: {
                    totalFiles: 2,
                    totalSize: 1024,
                    imageFiles: 2,
                    videoFiles: 0,
                    otherFiles: 0,
                    duplicateCount: 0,
                },
            };

            const result = transformPreviewResponse(apiResponse);

            expect(result.files).toEqual(apiResponse.fileGroups);
            expect(result.selectedFiles).toBeInstanceOf(Set);
            expect(result.selectedFiles.has("file1.jpg")).toBe(true);
            expect(result.selectedFiles.has("file2.jpg")).toBe(true);
            expect(result.totalCount).toBe(2);
            expect(result.totalSize).toBe(1024);
            expect(result.statistics).toEqual(apiResponse.statistics);
        });

        it("should handle empty API response", () => {
            const result = transformPreviewResponse({});

            expect(result.files).toEqual([]);
            expect(result.selectedFiles.size).toBe(0);
            expect(result.totalCount).toBe(0);
            expect(result.totalSize).toBe(0);
            expect(result.statistics).toEqual({
                imageFiles: 0,
                videoFiles: 0,
                otherFiles: 0,
                duplicateCount: 0,
            });
        });
    });

    describe("createPreviewConfig", () => {
        it("should create preview config from configuration data", () => {
            const configData = {
                sourcePaths: ["/source1"],
                targetPath: "/target",
                filters: { fileTypes: ["image"] },
                duplicateStrategy: "skip",
            };

            const result = createPreviewConfig(configData);

            expect(result.sourcePaths).toEqual(["/source1"]);
            expect(result.targetPath).toBe("/target");
            expect(result.filters.fileTypes).toEqual(["image"]);
            expect(result.filters.includeSubfolders).toBe(true);
            expect(result.filters.sizeRange).toEqual({ min: 0, max: Number.MAX_SAFE_INTEGER });
            expect(result.filters.dateRange).toBeDefined();
            expect(result.duplicateStrategy).toBe("skip");
            expect(result.fileGroups).toEqual([]);
            expect(result.selectedFiles).toEqual([]);
            expect(result.allowDuplicateRename).toBe(true);
        });

        it("should handle missing configuration data", () => {
            const result = createPreviewConfig({});

            expect(result.sourcePaths).toEqual([]);
            expect(result.targetPath).toBe("");
            expect(result.duplicateStrategy).toBe("rename");
        });
    });
});
