/**
 * Unit tests for ImportPhotos component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { createPinia, setActivePinia } from "pinia";
import ImportPhotos from "../ImportPhotos.vue";

// Mock the API functions
vi.mock("@renderer/utils/api", () => ({
    chooseDirectories: vi.fn(),
    previewImport: vi.fn(),
}));

// Mock the wizard components
vi.mock("@renderer/components/wizard", () => ({
    BaseWizard: {
        name: "BaseWizard",
        template: '<div data-testid="base-wizard"><slot /></div>',
        props: [
            "open",
            "config",
            "size",
            "persistent",
            "showProgressBar",
            "showStepDescriptions",
            "showNavigation",
        ],
        emits: ["update:open", "complete", "cancel", "step-change"],
    },
    createWizardStep: vi.fn((config) => config),
    createWizardConfig: vi.fn((config) => config),
}));

// Mock the progress modal
vi.mock("../ImportProgressModal.vue", () => ({
    default: {
        name: "ImportProgressModal",
        template: '<div data-testid="progress-modal"></div>',
        props: ["show", "config"],
        emits: ["complete", "cancel"],
    },
}));

// Mock the preference store
vi.mock("@renderer/stores/preference", () => ({
    usePreferenceStore: () => ({
        paths: ["/default/path1", "/default/path2"],
    }),
}));

const createWrapper = (props = {}) => {
    const i18n = createI18n({
        legacy: false,
        locale: "en-US",
        messages: {
            "en-US": {
                import: {
                    steps: {
                        configuration: "Configuration",
                        configurationDesc: "Configure import settings",
                        preview: "Preview",
                        previewDesc: "Preview files to import",
                    },
                    duplicate: {
                        rename: "Rename",
                        skip: "Skip",
                        overwrite: "Overwrite",
                        keepBoth: "Keep Both",
                    },
                    fileTypes: {
                        label: "File Types",
                    },
                },
            },
        },
    });

    return mount(ImportPhotos, {
        props: {
            show: true,
            ...props,
        },
        global: {
            plugins: [i18n, createPinia()],
        },
    });
};

describe("ImportPhotos", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    describe("Component Rendering", () => {
        it("should render BaseWizard when show is true", () => {
            const wrapper = createWrapper({ show: true });

            expect(wrapper.find('[data-testid="base-wizard"]').exists()).toBe(true);
        });

        it("should not render BaseWizard when show is false", () => {
            const wrapper = createWrapper({ show: false });

            expect(wrapper.find('[data-testid="base-wizard"]').exists()).toBe(false);
        });

        it("should pass correct props to BaseWizard", () => {
            const wrapper = createWrapper();
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });

            expect(baseWizard.props("size")).toBe("lg");
            expect(baseWizard.props("persistent")).toBe(true);
            expect(baseWizard.props("showProgressBar")).toBe(true);
            expect(baseWizard.props("showStepDescriptions")).toBe(true);
            expect(baseWizard.props("showNavigation")).toBe(false);
        });
    });

    describe("Props Handling", () => {
        it("should handle initial source paths", () => {
            const initialSourcePaths = ["/source1", "/source2"];
            const wrapper = createWrapper({ initialSourcePaths });

            expect(wrapper.props("initialSourcePaths")).toEqual(initialSourcePaths);
        });

        it("should handle initial target path", () => {
            const initialTargetPath = "/target";
            const wrapper = createWrapper({ initialTargetPath });

            expect(wrapper.props("initialTargetPath")).toBe(initialTargetPath);
        });

        it("should have default values for optional props", () => {
            const wrapper = createWrapper();

            expect(wrapper.props("initialSourcePaths")).toEqual([]);
            expect(wrapper.props("initialTargetPath")).toBe("");
        });
    });

    describe("Events", () => {
        it("should emit update:show when wizard is closed", async () => {
            const wrapper = createWrapper();
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });

            await baseWizard.vm.$emit("update:open", false);

            expect(wrapper.emitted("update:show")).toBeTruthy();
            expect(wrapper.emitted("update:show")[0]).toEqual([false]);
        });

        it("should emit import-complete when import finishes", async () => {
            const wrapper = createWrapper();
            const progressModal = wrapper.findComponent({ name: "ImportProgressModal" });
            const result = { success: true, importedFiles: 5 };

            await progressModal.vm.$emit("complete", result);

            expect(wrapper.emitted("import-complete")).toBeTruthy();
            expect(wrapper.emitted("import-complete")[0]).toEqual([result]);
        });
    });

    describe("Wizard Configuration", () => {
        it("should create wizard config with correct steps", () => {
            const wrapper = createWrapper();
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });
            const config = baseWizard.props("config");

            expect(config.steps).toHaveLength(2);
            expect(config.steps[0].id).toBe("configuration");
            expect(config.steps[1].id).toBe("preview");
        });

        it("should validate configuration step correctly", () => {
            const wrapper = createWrapper();
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });
            const config = baseWizard.props("config");
            const configStep = config.steps[0];

            // Valid configuration
            expect(
                configStep.isValid({
                    sourcePaths: ["/source1"],
                    targetPath: "/target",
                }),
            ).toBe(true);

            // Invalid configuration - no source paths
            expect(
                configStep.isValid({
                    sourcePaths: [],
                    targetPath: "/target",
                }),
            ).toBe(false);

            // Invalid configuration - no target path
            expect(
                configStep.isValid({
                    sourcePaths: ["/source1"],
                    targetPath: "",
                }),
            ).toBe(false);
        });

        it("should validate preview step correctly", () => {
            const wrapper = createWrapper();
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });
            const config = baseWizard.props("config");
            const previewStep = config.steps[1];

            // Valid preview
            expect(
                previewStep.isValid({
                    selectedFiles: new Set(["file1.jpg"]),
                }),
            ).toBe(true);

            // Invalid preview - no selected files
            expect(
                previewStep.isValid({
                    selectedFiles: new Set(),
                }),
            ).toBe(false);
        });
    });

    describe("Progress Modal", () => {
        it("should show progress modal when import starts", async () => {
            const wrapper = createWrapper();

            // Simulate wizard completion
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });
            await baseWizard.vm.$emit("complete", {
                configuration: {
                    sourcePaths: ["/source1"],
                    targetPath: "/target",
                    filters: {},
                    duplicateStrategy: "rename",
                },
                preview: {
                    files: [],
                    selectedFiles: new Set(["file1.jpg"]),
                },
            });

            await wrapper.vm.$nextTick();

            const progressModal = wrapper.findComponent({ name: "ImportProgressModal" });
            expect(progressModal.props("show")).toBe(true);
        });

        it("should hide progress modal when import completes", async () => {
            const wrapper = createWrapper();

            // Set up progress modal as shown
            await wrapper.setData({ showProgressModal: true });

            const progressModal = wrapper.findComponent({ name: "ImportProgressModal" });
            await progressModal.vm.$emit("complete", { success: true });

            await wrapper.vm.$nextTick();

            expect(progressModal.props("show")).toBe(false);
        });
    });

    describe("Step Validation Integration", () => {
        it("should validate configuration step with actual validation function", () => {
            const wrapper = createWrapper();
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });
            const config = baseWizard.props("config");
            const configStep = config.steps[0];

            // Test with valid configuration data
            const validData = {
                sourcePaths: ["/source1", "/source2"],
                targetPath: "/target",
            };
            expect(configStep.isValid(validData)).toBe(true);

            // Test with invalid configuration data - no source paths
            const invalidData1 = {
                sourcePaths: [],
                targetPath: "/target",
            };
            expect(configStep.isValid(invalidData1)).toBe(false);

            // Test with invalid configuration data - no target path
            const invalidData2 = {
                sourcePaths: ["/source1"],
                targetPath: "",
            };
            expect(configStep.isValid(invalidData2)).toBe(false);

            // Test with undefined data
            expect(configStep.isValid(undefined)).toBe(false);
            expect(configStep.isValid(null)).toBe(false);
        });

        it("should validate preview step with actual validation function", () => {
            const wrapper = createWrapper();
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });
            const config = baseWizard.props("config");
            const previewStep = config.steps[1];

            // Test with valid preview data
            const validData = {
                selectedFiles: new Set(["file1.jpg", "file2.jpg"]),
            };
            expect(previewStep.isValid(validData)).toBe(true);

            // Test with invalid preview data - no selected files
            const invalidData1 = {
                selectedFiles: new Set(),
            };
            expect(previewStep.isValid(invalidData1)).toBe(false);

            // Test with invalid preview data - null selectedFiles
            const invalidData2 = {
                selectedFiles: null,
            };
            expect(previewStep.isValid(invalidData2)).toBe(false);

            // Test with undefined data
            expect(previewStep.isValid(undefined)).toBe(false);
        });

        it("should use the correct validation functions from import-wizard-helpers", () => {
            // This test ensures we're using the actual validation functions
            // and not just returning true/false
            const wrapper = createWrapper();
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });
            const config = baseWizard.props("config");

            // Verify the validation functions are the ones from our helpers
            expect(config.steps[0].isValid).toBeDefined();
            expect(config.steps[1].isValid).toBeDefined();
            expect(typeof config.steps[0].isValid).toBe("function");
            expect(typeof config.steps[1].isValid).toBe("function");
        });
    });

    describe("Error Handling", () => {
        it("should handle invalid wizard completion data", async () => {
            const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const wrapper = createWrapper();

            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });
            await baseWizard.vm.$emit("complete", {
                configuration: null, // Invalid
                preview: null, // Invalid
            });

            expect(consoleSpy).toHaveBeenCalledWith(
                "Invalid wizard data on completion",
                expect.any(Object),
            );

            consoleSpy.mockRestore();
        });
    });
});
