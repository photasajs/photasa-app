/**
 * Unit tests for ImportProgressModal component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ImportProgressModal from "../ImportProgressModal.vue";

// Ensure global Date is properly available
global.Date = Date;
global.Date.now = Date.now || (() => new Date().getTime());

// Mock Date constructor and Date.now for consistent testing
const mockDate = new Date(1640995200000); // 2022-01-01T00:00:00.000Z
const mockDateNow = vi.fn(() => 1640995200000);

// Mock Date constructor
global.Date = vi.fn(() => mockDate) as any;
global.Date.now = mockDateNow;

// Preserve static methods
Object.setPrototypeOf(global.Date, Date);
Object.defineProperty(global.Date, "now", {
    value: mockDateNow,
    writable: true,
});

// Mock all external dependencies
vi.mock("@renderer/utils/api");
vi.mock("@renderer/utils/import-helpers");
vi.mock("@renderer/utils/import-wizard-helpers");
vi.mock("@common/logger");

describe("ImportProgressModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Component Rendering", () => {
        it("should render when show is true", () => {
            const wrapper = mount(ImportProgressModal, {
                props: { show: true, config: null },
            });
            expect(wrapper.exists()).toBe(true);
        });

        it("should render when show is false", () => {
            const wrapper = mount(ImportProgressModal, {
                props: { show: false, config: null },
            });
            expect(wrapper.exists()).toBe(true);
        });
    });

    describe("Core Functionality", () => {
        it("should have correct initial state", () => {
            const wrapper = mount(ImportProgressModal, {
                props: { show: true, config: null },
            });
            const vm = wrapper.vm as any;

            expect(vm.importProgress.totalFiles).toBe(0);
            expect(vm.importProgress.processedFiles).toBe(0);
            expect(vm.importProgress.speed).toBe(0);
            expect(vm.importProgress.status).toBe("preparing");
            expect(vm.isImporting).toBe(false);
            expect(vm.isPaused).toBe(false);
        });

        it("should calculate progress percentage correctly", () => {
            const wrapper = mount(ImportProgressModal, {
                props: { show: true, config: null },
            });
            const vm = wrapper.vm as any;

            // Set progress data
            vm.importProgress.totalFiles = 100;
            vm.importProgress.processedFiles = 25;

            // Progress should be 25%
            expect(vm.progressPercentage).toBe(25);
        });

        it("should handle zero files gracefully", () => {
            const wrapper = mount(ImportProgressModal, {
                props: { show: true, config: null },
            });
            const vm = wrapper.vm as any;

            // Set zero files
            vm.importProgress.totalFiles = 0;
            vm.importProgress.processedFiles = 0;

            // Progress should be 0%
            expect(vm.progressPercentage).toBe(0);
        });
    });

    describe("Status Management", () => {
        it("should have correct status icon for different states", () => {
            const wrapper = mount(ImportProgressModal, {
                props: { show: true, config: null },
            });
            const vm = wrapper.vm as any;

            // Test different statuses
            vm.importProgress.status = "completed";
            expect(vm.statusIcon).toBeDefined();

            vm.importProgress.status = "failed";
            expect(vm.statusIcon).toBeDefined();

            vm.importProgress.status = "cancelled";
            expect(vm.statusIcon).toBeDefined();

            vm.importProgress.status = "paused";
            expect(vm.statusIcon).toBeDefined();
        });

        it("should have correct status colors", () => {
            const wrapper = mount(ImportProgressModal, {
                props: { show: true, config: null },
            });
            const vm = wrapper.vm as any;

            // Test different status colors
            vm.importProgress.status = "completed";
            expect(vm.statusColor).toContain("green");

            vm.importProgress.status = "failed";
            expect(vm.statusColor).toContain("red");

            vm.importProgress.status = "cancelled";
            expect(vm.statusColor).toContain("red");

            vm.importProgress.status = "paused";
            expect(vm.statusColor).toContain("yellow");
        });

        it("should determine if modal can be closed correctly", () => {
            const wrapper = mount(ImportProgressModal, {
                props: { show: true, config: null },
            });
            const vm = wrapper.vm as any;

            // Test different states
            vm.importProgress.status = "processing";
            expect(vm.canClose).toBe(false);

            vm.importProgress.status = "completed";
            expect(vm.canClose).toBe(true);

            vm.importProgress.status = "failed";
            expect(vm.canClose).toBe(true);

            vm.importProgress.status = "cancelled";
            expect(vm.canClose).toBe(true);
        });
    });

    describe("Props Validation", () => {
        it("should accept show prop", () => {
            const wrapper = mount(ImportProgressModal, {
                props: { show: true, config: null },
            });
            expect(wrapper.props("show")).toBe(true);
        });

        it("should accept config prop", () => {
            const mockConfig = {
                sourcePaths: ["/test"],
                targetPath: "/target",
                filters: {
                    fileTypes: ["image" as const],
                    sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                    dateRange: { start: new Date(0), end: new Date() },
                    includeSubfolders: true,
                    excludePaths: [],
                },
                duplicateStrategy: "rename" as const,
                fileGroups: [],
                selectedFiles: ["test.jpg"],
                allowDuplicateRename: true,
            };
            const wrapper = mount(ImportProgressModal, {
                props: { show: true, config: mockConfig },
            });
            expect(wrapper.props("config")).toEqual(mockConfig);
        });
    });

    describe("Component Structure", () => {
        it("should have required reactive properties", () => {
            const wrapper = mount(ImportProgressModal, {
                props: { show: true, config: null },
            });
            const vm = wrapper.vm as any;

            expect(vm.importId).toBeDefined();
            expect(vm.isPaused).toBeDefined();
            expect(vm.canCancel).toBeDefined();
            expect(vm.isImporting).toBeDefined();
            expect(vm.importProgress).toBeDefined();
            expect(vm.importResult).toBeDefined();
            expect(vm.importError).toBeDefined();
        });

        it("should have required computed properties", () => {
            const wrapper = mount(ImportProgressModal, {
                props: { show: true, config: null },
            });
            const vm = wrapper.vm as any;

            expect(vm.progressPercentage).toBeDefined();
            expect(vm.statusIcon).toBeDefined();
            expect(vm.statusColor).toBeDefined();
            expect(vm.canClose).toBeDefined();
        });
    });
});
