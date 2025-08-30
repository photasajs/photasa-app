import { describe, it, expect } from "vitest";
import {
    createDefaultFilters,
    createImportConfig,
    canPreviewImport,
    canExecuteImport,
    addSourceDirectories,
    removeSourceDirectory,
    updateFileTypeFilter,
    isFileSelected,
    toggleFileSelection,
    formatFileSize,
    formatProcessingSpeed,
    formatRemainingTime,
    calculateProgressPercentage,
    createInitialFilePreviewState,
    validateImportConfig,
} from "../import-helpers";
import type { ImportFilters, FileGroup, ImportConfig } from "@common/import-types";

describe("import-helpers", () => {
    describe("createDefaultFilters", () => {
        it("should create default filters with correct values", () => {
            const filters = createDefaultFilters();

            expect(filters.fileTypes).toEqual(["image", "video"]);
            expect(filters.sizeRange).toEqual({ min: 0, max: Number.MAX_SAFE_INTEGER });
            expect(filters.includeSubfolders).toBe(true);
            expect(filters.dateRange.start).toBeInstanceOf(Date);
            expect(filters.dateRange.end).toBeInstanceOf(Date);
        });
    });

    describe("createImportConfig", () => {
        it("should create import config with provided values", () => {
            const sourcePaths = ["/path/to/source"];
            const targetPath = "/path/to/target";
            const filters = createDefaultFilters();
            const duplicateStrategy = "rename" as const;

            const config = createImportConfig(sourcePaths, targetPath, filters, duplicateStrategy);

            expect(config.sourcePaths).toEqual(sourcePaths);
            expect(config.targetPath).toBe(targetPath);
            expect(config.filters).toBe(filters);
            expect(config.duplicateStrategy).toBe(duplicateStrategy);
            expect(config.fileGroups).toEqual([]);
            expect(config.selectedFiles).toEqual([]);
            expect(config.allowDuplicateRename).toBe(true);
        });

        it("should create import config with custom optional values", () => {
            const sourcePaths = ["/path/to/source"];
            const targetPath = "/path/to/target";
            const filters = createDefaultFilters();
            const duplicateStrategy = "skip" as const;
            const fileGroups = [] as FileGroup[];
            const selectedFiles = ["/file1", "/file2"];
            const allowDuplicateRename = false;

            const config = createImportConfig(
                sourcePaths,
                targetPath,
                filters,
                duplicateStrategy,
                fileGroups,
                selectedFiles,
                allowDuplicateRename,
            );

            expect(config.selectedFiles).toEqual(selectedFiles);
            expect(config.allowDuplicateRename).toBe(false);
        });
    });

    describe("canPreviewImport", () => {
        it("should return true when both sourcePaths and targetPath are provided", () => {
            expect(canPreviewImport(["/source"], "/target")).toBe(true);
        });

        it("should return false when sourcePaths is empty", () => {
            expect(canPreviewImport([], "/target")).toBe(false);
        });

        it("should return false when targetPath is empty", () => {
            expect(canPreviewImport(["/source"], "")).toBe(false);
        });

        it("should return false when both are empty", () => {
            expect(canPreviewImport([], "")).toBe(false);
        });
    });

    describe("canExecuteImport", () => {
        it("should return true when all conditions are met", () => {
            const fileGroups = [{ files: [] }] as FileGroup[];
            expect(canExecuteImport(["/source"], "/target", fileGroups, true)).toBe(true);
        });

        it("should return true when showPreview is false even without fileGroups", () => {
            expect(canExecuteImport(["/source"], "/target", [], false)).toBe(true);
        });

        it("should return false when sourcePaths is empty", () => {
            expect(canExecuteImport([], "/target", [], false)).toBe(false);
        });

        it("should return false when targetPath is empty", () => {
            expect(canExecuteImport(["/source"], "", [], false)).toBe(false);
        });

        it("should return false when showPreview is true but no fileGroups", () => {
            expect(canExecuteImport(["/source"], "/target", [], true)).toBe(false);
        });
    });

    describe("addSourceDirectories", () => {
        it("should add new directories to existing list", () => {
            const current = ["/path1"];
            const newPaths = ["/path2", "/path3"];
            const result = addSourceDirectories(current, newPaths);

            expect(result).toEqual(["/path1", "/path2", "/path3"]);
            expect(result).not.toBe(current); // Should return new array
        });

        it("should avoid duplicates", () => {
            const current = ["/path1", "/path2"];
            const newPaths = ["/path2", "/path3"];
            const result = addSourceDirectories(current, newPaths);

            expect(result).toEqual(["/path1", "/path2", "/path3"]);
        });

        it("should handle empty current list", () => {
            const result = addSourceDirectories([], ["/path1", "/path2"]);
            expect(result).toEqual(["/path1", "/path2"]);
        });

        it("should handle empty new paths", () => {
            const current = ["/path1"];
            const result = addSourceDirectories(current, []);
            expect(result).toEqual(["/path1"]);
        });
    });

    describe("removeSourceDirectory", () => {
        it("should remove directory at specified index", () => {
            const current = ["/path1", "/path2", "/path3"];
            const result = removeSourceDirectory(current, 1);

            expect(result).toEqual(["/path1", "/path3"]);
            expect(result).not.toBe(current); // Should return new array
        });

        it("should handle removing first element", () => {
            const current = ["/path1", "/path2"];
            const result = removeSourceDirectory(current, 0);
            expect(result).toEqual(["/path2"]);
        });

        it("should handle removing last element", () => {
            const current = ["/path1", "/path2"];
            const result = removeSourceDirectory(current, 1);
            expect(result).toEqual(["/path1"]);
        });

        it("should handle single element array", () => {
            const current = ["/path1"];
            const result = removeSourceDirectory(current, 0);
            expect(result).toEqual([]);
        });
    });

    describe("updateFileTypeFilter", () => {
        it("should add file type when enabled and not present", () => {
            const filters: ImportFilters = {
                fileTypes: ["image"],
                sizeRange: { min: 0, max: 100 },
                dateRange: { start: new Date(), end: new Date() },
                includeSubfolders: true,
            };

            const result = updateFileTypeFilter(filters, "video", true);
            expect(result.fileTypes).toEqual(["image", "video"]);
        });

        it("should not add duplicate file type", () => {
            const filters: ImportFilters = {
                fileTypes: ["image", "video"],
                sizeRange: { min: 0, max: 100 },
                dateRange: { start: new Date(), end: new Date() },
                includeSubfolders: true,
            };

            const result = updateFileTypeFilter(filters, "image", true);
            expect(result.fileTypes).toEqual(["image", "video"]);
        });

        it("should remove file type when disabled", () => {
            const filters: ImportFilters = {
                fileTypes: ["image", "video"],
                sizeRange: { min: 0, max: 100 },
                dateRange: { start: new Date(), end: new Date() },
                includeSubfolders: true,
            };

            const result = updateFileTypeFilter(filters, "video", false);
            expect(result.fileTypes).toEqual(["image"]);
        });

        it("should not modify filters when removing non-existent type", () => {
            const filters: ImportFilters = {
                fileTypes: ["image"],
                sizeRange: { min: 0, max: 100 },
                dateRange: { start: new Date(), end: new Date() },
                includeSubfolders: true,
            };

            const result = updateFileTypeFilter(filters, "video", false);
            expect(result.fileTypes).toEqual(["image"]);
        });
    });

    describe("isFileSelected", () => {
        it("should return true when file is in selection", () => {
            const selectedFiles = new Set(["/file1", "/file2"]);
            expect(isFileSelected("/file1", selectedFiles)).toBe(true);
        });

        it("should return false when file is not in selection", () => {
            const selectedFiles = new Set(["/file1", "/file2"]);
            expect(isFileSelected("/file3", selectedFiles)).toBe(false);
        });

        it("should handle empty selection", () => {
            const selectedFiles = new Set<string>();
            expect(isFileSelected("/file1", selectedFiles)).toBe(false);
        });
    });

    describe("toggleFileSelection", () => {
        it("should add file when not selected", () => {
            const selectedFiles = new Set(["/file1"]);
            const result = toggleFileSelection("/file2", selectedFiles);

            expect(result.has("/file1")).toBe(true);
            expect(result.has("/file2")).toBe(true);
            expect(result).not.toBe(selectedFiles); // Should return new Set
        });

        it("should remove file when already selected", () => {
            const selectedFiles = new Set(["/file1", "/file2"]);
            const result = toggleFileSelection("/file2", selectedFiles);

            expect(result.has("/file1")).toBe(true);
            expect(result.has("/file2")).toBe(false);
        });

        it("should handle empty selection", () => {
            const selectedFiles = new Set<string>();
            const result = toggleFileSelection("/file1", selectedFiles);

            expect(result.has("/file1")).toBe(true);
        });
    });

    describe("formatFileSize", () => {
        it("should format bytes correctly", () => {
            expect(formatFileSize(500)).toBe("500 B");
            expect(formatFileSize(0)).toBe("0 B");
        });

        it("should format kilobytes correctly", () => {
            expect(formatFileSize(1024)).toBe("1.0 KB");
            expect(formatFileSize(1536)).toBe("1.5 KB");
        });

        it("should format megabytes correctly", () => {
            expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
            expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
        });

        it("should format gigabytes correctly", () => {
            expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.0 GB");
            expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
        });
    });

    describe("formatProcessingSpeed", () => {
        it("should format speed less than 1 file/sec as files/min", () => {
            expect(formatProcessingSpeed(0.5)).toBe("30.0 files/min");
            expect(formatProcessingSpeed(0.1)).toBe("6.0 files/min");
        });

        it("should format speed >= 1 file/sec as files/sec", () => {
            expect(formatProcessingSpeed(1)).toBe("1.0 files/sec");
            expect(formatProcessingSpeed(2.5)).toBe("2.5 files/sec");
        });
    });

    describe("formatRemainingTime", () => {
        it("should format seconds correctly", () => {
            expect(formatRemainingTime(30)).toBe("30s");
            expect(formatRemainingTime(45.7)).toBe("46s");
        });

        it("should format minutes and seconds correctly", () => {
            expect(formatRemainingTime(90)).toBe("1m 30s");
            expect(formatRemainingTime(125)).toBe("2m 5s");
        });

        it("should format hours and minutes correctly", () => {
            expect(formatRemainingTime(3661)).toBe("1h 1m");
            expect(formatRemainingTime(7200)).toBe("2h 0m");
        });
    });

    describe("calculateProgressPercentage", () => {
        it("should calculate percentage correctly", () => {
            expect(calculateProgressPercentage(50, 100)).toBe(50);
            expect(calculateProgressPercentage(1, 3)).toBe(33);
            expect(calculateProgressPercentage(2, 3)).toBe(67);
        });

        it("should handle zero total", () => {
            expect(calculateProgressPercentage(0, 0)).toBe(0);
            expect(calculateProgressPercentage(5, 0)).toBe(0);
        });

        it("should handle complete progress", () => {
            expect(calculateProgressPercentage(100, 100)).toBe(100);
        });
    });

    describe("createInitialFilePreviewState", () => {
        it("should create initial state with correct structure", () => {
            const state = createInitialFilePreviewState();

            expect(state.files).toEqual([]);
            expect(state.selectedFiles).toBeInstanceOf(Set);
            expect(state.selectedFiles.size).toBe(0);
            expect(state.totalCount).toBe(0);
            expect(state.totalSize).toBe(0);
            expect(state.statistics).toEqual({
                imageFiles: 0,
                videoFiles: 0,
                otherFiles: 0,
                duplicateCount: 0,
            });
        });
    });

    describe("validateImportConfig", () => {
        it("should validate correct config", () => {
            const config: ImportConfig = {
                sourcePaths: ["/source"],
                targetPath: "/target",
                filters: {
                    fileTypes: ["image"],
                    sizeRange: { min: 0, max: 100 },
                    dateRange: { start: new Date(), end: new Date() },
                    includeSubfolders: true,
                },
                duplicateStrategy: "rename",
                fileGroups: [],
                selectedFiles: [],
                allowDuplicateRename: true,
            };

            const result = validateImportConfig(config);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it("should detect missing source paths", () => {
            const config: ImportConfig = {
                sourcePaths: [],
                targetPath: "/target",
                filters: {
                    fileTypes: ["image"],
                    sizeRange: { min: 0, max: 100 },
                    dateRange: { start: new Date(), end: new Date() },
                    includeSubfolders: true,
                },
                duplicateStrategy: "rename",
                fileGroups: [],
                selectedFiles: [],
                allowDuplicateRename: true,
            };

            const result = validateImportConfig(config);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain("请至少选择一个源目录");
        });

        it("should detect missing target path", () => {
            const config: ImportConfig = {
                sourcePaths: ["/source"],
                targetPath: "",
                filters: {
                    fileTypes: ["image"],
                    sizeRange: { min: 0, max: 100 },
                    dateRange: { start: new Date(), end: new Date() },
                    includeSubfolders: true,
                },
                duplicateStrategy: "rename",
                fileGroups: [],
                selectedFiles: [],
                allowDuplicateRename: true,
            };

            const result = validateImportConfig(config);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain("请选择目标目录");
        });

        it("should detect missing file types", () => {
            const config: ImportConfig = {
                sourcePaths: ["/source"],
                targetPath: "/target",
                filters: {
                    fileTypes: [],
                    sizeRange: { min: 0, max: 100 },
                    dateRange: { start: new Date(), end: new Date() },
                    includeSubfolders: true,
                },
                duplicateStrategy: "rename",
                fileGroups: [],
                selectedFiles: [],
                allowDuplicateRename: true,
            };

            const result = validateImportConfig(config);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain("请至少选择一种文件类型");
        });

        it("should detect multiple validation errors", () => {
            const config: ImportConfig = {
                sourcePaths: [],
                targetPath: "",
                filters: {
                    fileTypes: [],
                    sizeRange: { min: 0, max: 100 },
                    dateRange: { start: new Date(), end: new Date() },
                    includeSubfolders: true,
                },
                duplicateStrategy: "rename",
                fileGroups: [],
                selectedFiles: [],
                allowDuplicateRename: true,
            };

            const result = validateImportConfig(config);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(3);
        });
    });
});
