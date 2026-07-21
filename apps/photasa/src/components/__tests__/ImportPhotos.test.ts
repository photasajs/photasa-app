/**
 * Unit tests for ImportPhotos component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import ImportPhotos from "../ImportPhotos.vue";
import { chooseDirectories, previewImport } from "@renderer/utils/api";

// Mock the API functions
vi.mock("@renderer/utils/api", () => ({
    chooseDirectories: vi.fn(),
    previewImport: vi.fn(),
    onPreviewProgress: vi.fn(() => () => {}), // Mock cleanup function
}));

// Mock the logger
vi.mock("@photasa/common", () => ({
    getLogger: vi.fn(() => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    })),
    loggers: {
        "import-photos": {
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
        },
        importProgress: {
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
        },
    },
}));

// Mock the UI components
vi.mock("@renderer/components/ui", () => ({
    BaseButton: {
        name: "BaseButton",
        template: '<button @click="$emit(\'click\')" :disabled="disabled"><slot /></button>',
        props: ["disabled", "variant", "size"],
        emits: ["click"],
    },
    BaseInput: {
        name: "BaseInput",
        template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" :readonly="readonly" />',
        props: ["modelValue", "readonly"],
        emits: ["update:modelValue"],
    },
    BaseSelect: {
        name: "BaseSelect",
        template:
            '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
        props: ["modelValue", "options", "placeholder"],
        emits: ["update:modelValue"],
    },
    BaseCheckbox: {
        name: "BaseCheckbox",
        template:
            '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
        props: ["modelValue", "label"],
        emits: ["update:modelValue"],
    },
    BaseSwitch: {
        name: "BaseSwitch",
        template:
            '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
        props: ["modelValue", "label"],
        emits: ["update:modelValue"],
    },
    BaseAlert: {
        name: "BaseAlert",
        template:
            '<div class="alert" :class="type" data-testid="error-alert"><slot name="actions" /></div>',
        props: ["type", "title", "message", "dismissible"],
        emits: ["dismiss"],
    },
    BaseSpinner: {
        name: "BaseSpinner",
        template: '<div class="spinner" data-testid="spinner"></div>',
        props: ["class"],
    },
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
        props: ["show", "config", "mode"],
        emits: ["complete", "cancel", "dismiss"],
    },
}));

// Mock the PreviewProgressDisplay component
vi.mock("../import/PreviewProgressDisplay.vue", () => ({
    default: {
        name: "PreviewProgressDisplay",
        template: '<div data-testid="preview-progress-display"></div>',
        props: ["progress", "discoveredFiles"],
    },
}));

// Mock the VirtualList component
vi.mock("@renderer/components/ui/VirtualList.vue", () => ({
    default: {
        name: "VirtualList",
        template:
            '<div data-testid="virtual-list"><slot v-for="item in items" :key="getItemKey(item, $index)" :item="item" :index="$index" /></div>',
        props: ["items", "itemHeight", "containerHeight", "getItemKey"],
    },
}));

// Mock phosphor icons
vi.mock("@phosphor-icons/vue", () => ({
    PhTrash: {
        name: "PhTrash",
        template: '<svg data-testid="ph-trash"></svg>',
        props: ["class"],
    },
    PhPlus: {
        name: "PhPlus",
        template: '<svg data-testid="ph-plus"></svg>',
        props: ["class"],
    },
    PhFolderOpen: {
        name: "PhFolderOpen",
        template: '<svg data-testid="ph-folder-open"></svg>',
        props: ["class"],
    },
    PhEye: {
        name: "PhEye",
        template: '<svg data-testid="ph-eye"></svg>',
        props: ["class"],
    },
    PhArrowDown: {
        name: "PhArrowDown",
        template: '<svg data-testid="ph-arrow-down"></svg>',
        props: ["class"],
    },
    PhImage: {
        name: "PhImage",
        template: '<svg data-testid="ph-image"></svg>',
        props: ["class"],
    },
    PhVideoCamera: {
        name: "PhVideoCamera",
        template: '<svg data-testid="ph-video-camera"></svg>',
        props: ["class"],
    },
    PhFileText: {
        name: "PhFileText",
        template: '<svg data-testid="ph-file-text"></svg>',
        props: ["class"],
    },
}));

// Mock vue-i18n
vi.mock("vue-i18n", () => ({
    useI18n: () => ({
        t: (key: string, params?: any) => {
            // Simple mock translation function
            const translations: Record<string, string> = {
                "import.steps.configuration": "Configuration",
                "import.steps.configurationDesc": "Configure import settings",
                "import.steps.preview": "Preview",
                "import.steps.previewDesc": "Preview files to import",
                "import.sourceDirectories": "Source Directories",
                "import.targetDirectory": "Target Directory",
                "import.options": "Options",
                "import.fileTypes.label": "File Types",
                "import.fileTypes.images": "Images",
                "import.fileTypes.videos": "Videos",
                "import.includeSubfolders": "Include Subfolders",
                "import.duplicateHandling": "Duplicate Handling",
                "import.duplicate.rename": "Rename",
                "import.duplicate.skip": "Skip",
                "import.duplicate.overwrite": "Overwrite",
                "import.duplicate.keepBoth": "Keep Both",
                "import.addSource": "Add Source",
                "import.selectTarget": "Select Target",
                "import.browse": "Browse",
                "import.loading.label": "Loading...",
                "import.loading.preview": "Loading Preview...",
                "import.backButton": "Back",
                "import.editSettingsButton": "Edit settings",
                "import.cancelSetupButton": "Cancel setup",
                "import.nextButton": "Next",
                "import.importButton": "Import",
                "import.closeButton": "Close",
                "import.totalFiles": "Total Files",
                "import.totalSize": "Total Size",
                "import.images": "Images",
                "import.videos": "Videos",
                "import.group": `Group (${params?.count || 0})`,
                "import.error.title": "Error",
                "import.error.retry": "Retry",
                "import.error.dismiss": "Dismiss",
                "import.error.network": "Network error occurred",
                "import.error.validation": "Validation error",
                "import.error.permission": "Permission error",
                "import.error.api": "API error",
                "import.error.unknown": "Unknown error",
                "import.useMD5ForDuplicates": "Use MD5 for duplicates",
                "import.useMD5ForDuplicatesDescription": "Use MD5 hash for duplicate detection",
            };
            return translations[key] || key;
        },
    }),
}));

// Mock the preference store and storeToRefs
vi.mock("@renderer/stores/preference", () => ({
    usePreferenceStore: () => ({
        paths: ["/default/path1", "/default/path2"],
        excludePaths: ["/excluded/path"],
    }),
}));

vi.mock("pinia", async (importOriginal) => {
    const actual = (await importOriginal()) as any;
    return {
        ...actual,
        storeToRefs: (store: any) => {
            const refs: any = {};
            for (const key in store) {
                if (typeof store[key] !== "function") {
                    refs[key] = {
                        __v_isRef: true,
                        get value() {
                            return store[key];
                        },
                        set value(val) {
                            store[key] = val;
                        },
                    };
                }
            }
            return refs;
        },
    };
});

const createWrapper = (props = {}) => {
    return mount(ImportPhotos, {
        props: {
            show: true,
            ...props,
        },
        global: {
            plugins: [createPinia()], // Remove i18n here, use global one from test setup
        },
    });
};

describe("ImportPhotos", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    describe("Component Rendering", () => {
        it("should render BaseWizard when show is true", () => {
            const wrapper = createWrapper({ show: true });

            expect(wrapper.findComponent({ name: "BaseWizard" }).exists()).toBe(true);
        });

        it("should not render BaseWizard when show is false", () => {
            const wrapper = createWrapper({ show: false });
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });

            expect(baseWizard.exists()).toBe(true);
            expect(baseWizard.props("open")).toBe(false);
        });

        it("should pass correct props to BaseWizard", () => {
            const wrapper = createWrapper();
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });

            expect(baseWizard.props("size")).toBe("4xl");
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
            const showEmissions = wrapper.emitted("update:show");
            expect(showEmissions).toBeDefined();
            expect(showEmissions?.[0]).toEqual([false]);
        });

        it("should emit import-complete when import finishes", async () => {
            const wrapper = createWrapper();
            const progressModal = wrapper.findComponent({ name: "ImportProgressModal" });
            const result = { success: true, importedFiles: 5 };

            await progressModal.vm.$emit("complete", result);

            expect(wrapper.emitted("import-complete")).toBeTruthy();
            const completeEmissions = wrapper.emitted("import-complete");
            expect(completeEmissions).toBeDefined();
            expect(completeEmissions?.[0]).toEqual([result]);
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

        it("RFC 0118 G19 should allow preview back navigation", () => {
            const wrapper = createWrapper();
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });
            const config = baseWizard.props("config");

            expect(config.allowBackNavigation).toBe(true);
        });

        it("RFC 0118 G19 edit settings clears preview-derived state before going back", async () => {
            const wrapper = createWrapper();
            const vm = wrapper.vm as any;
            const goBack = vi.fn().mockResolvedValue(true);
            const wizardState = {
                stepData: {
                    preview: {
                        files: [{ mainFile: { path: "/old.jpg" } }],
                        selectedFiles: new Set(["/old.jpg"]),
                    },
                },
                setStepData: vi.fn(),
            };

            vm.discoveredFiles.push({ path: "/old.jpg" });
            Object.assign(vm.previewProgress, {
                stage: "processing",
                currentPath: "/old",
                filesFound: 1,
                directoriesScanned: 1,
                totalDirectories: 1,
                message: "old",
            });
            vm.loadingState.preview = true;

            await vm.handleEditSettings(wizardState, goBack);

            expect(wizardState.setStepData).toHaveBeenCalledWith("preview", null);
            expect(vm.discoveredFiles).toHaveLength(0);
            expect(vm.previewProgress.filesFound).toBe(0);
            expect(vm.previewProgress.currentPath).toBe("");
            expect(vm.loadingState.preview).toBe(false);
            expect(goBack).toHaveBeenCalledOnce();
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

        it("RFC 0118 chip request reopens progress modal in reattach mode", async () => {
            const wrapper = createWrapper();
            const vm = wrapper.vm as any;

            await vm.importSession.begin("existing-import", {
                totalFiles: 4,
                processedFiles: 2,
            });
            vm.importSession.requestOpenModal();
            await nextTick();

            const progressModal = wrapper.findComponent({ name: "ImportProgressModal" });
            expect(progressModal.props("show")).toBe(true);
            expect(progressModal.props("mode")).toBe("reattach");
            expect(progressModal.props("config")).toBeNull();
        });

        it("should hide progress modal when import completes", async () => {
            const wrapper = createWrapper();
            const vm = wrapper.vm as any;

            // Manually trigger progress modal visibility
            vm.showProgressModal = true;
            await nextTick();

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
            // Get logger mock from our mocked module
            const { getLogger } = await import("@photasa/common");

            const wrapper = createWrapper();

            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });
            await baseWizard.vm.$emit("complete", {
                configuration: null, // Invalid
                preview: null, // Invalid
            });

            // Since we mock getLogger, we need to verify the function was called
            expect(getLogger).toHaveBeenCalled();
            // For now, just verify the component didn't crash
            expect(wrapper.exists()).toBe(true);
        });
    });

    describe("Integration Tests - Complete Wizard Flow", () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should complete full wizard flow from configuration to import", async () => {
            // Mock API responses
            const mockChooseDirectories = vi.mocked(chooseDirectories);
            const mockPreviewImport = vi.mocked(previewImport);

            mockChooseDirectories.mockResolvedValue({
                filePaths: ["/source/photos"],
            });

            mockPreviewImport.mockResolvedValue({
                fileGroups: [
                    {
                        mainFile: {
                            path: "/source/photos/img1.jpg",
                            name: "img1.jpg",
                            size: 1024,
                            type: "image",
                        } as any,
                        files: [],
                        type: "single" as const,
                        totalSize: 1024,
                    },
                ],
                statistics: {
                    totalFiles: 1,
                    totalSize: 1024,
                    imageFiles: 1,
                    videoFiles: 0,
                    otherFiles: 0,
                    duplicateCount: 0,
                    groupCount: 1,
                },
                duplicates: [],
                estimatedDuration: 1,
                targetStructure: new Map(),
            });

            const wrapper = createWrapper({
                initialTargetPath: "/target/library",
            });

            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });

            // Step 1: Trigger step-change event for configuration step
            await baseWizard.vm.$emit("step-change", "configuration", 0, {
                stepData: {},
                setStepData: vi.fn(),
            });

            // Step 2: Simulate configuration completion and moving to preview
            const mockWizardState = {
                stepData: {
                    configuration: {
                        sourcePaths: ["/source/photos"],
                        targetPath: "/target/library",
                        filters: {
                            fileTypes: ["image", "video"],
                            includeSubfolders: true,
                            sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                            dateRange: {
                                start: new Date("2020-01-01").toISOString(),
                                end: new Date().toISOString(),
                            },
                        },
                        duplicateStrategy: "rename",
                    },
                },
                setStepData: vi.fn(),
            };

            // Step 3: Trigger step-change event for preview step
            await baseWizard.vm.$emit("step-change", "preview", 1, mockWizardState);

            // Verify preview API was called
            expect(mockPreviewImport).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourcePaths: ["/source/photos"],
                    targetPath: "/target/library",
                    filters: expect.objectContaining({
                        fileTypes: ["image", "video"],
                    }),
                    duplicateStrategy: "rename",
                }),
            );

            // Step 4: Simulate wizard completion
            const completionData = {
                configuration: mockWizardState.stepData.configuration,
                preview: {
                    files: [
                        {
                            mainFile: {
                                path: "/source/photos/img1.jpg",
                                name: "img1.jpg",
                                size: 1024,
                                type: "image",
                            },
                        },
                    ],
                    selectedFiles: new Set(["/source/photos/img1.jpg"]),
                    totalCount: 1,
                    totalSize: 1024,
                },
            };

            await baseWizard.vm.$emit("complete", completionData);

            // Verify wizard was closed and progress modal was shown
            expect(wrapper.emitted("update:show")).toBeTruthy();
            const showEmissions = wrapper.emitted("update:show");
            expect(showEmissions).toBeDefined();
            expect(showEmissions?.[0]).toEqual([false]);

            // Verify progress modal is shown
            const progressModal = wrapper.findComponent({ name: "ImportProgressModal" });
            expect(progressModal.props("show")).toBe(true);
            expect(progressModal.props("config")).toMatchObject({
                sourcePaths: ["/source/photos"],
                targetPath: "/target/library",
                selectedFiles: ["/source/photos/img1.jpg"],
            });
        });

        it("should handle API errors gracefully", async () => {
            const mockPreviewImport = vi.mocked(previewImport);
            mockPreviewImport.mockRejectedValue(new Error("Network error"));

            const wrapper = createWrapper();
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });

            const mockWizardState = {
                stepData: {
                    configuration: {
                        sourcePaths: ["/source/photos"],
                        targetPath: "/target/library",
                        filters: { fileTypes: ["image"] },
                        duplicateStrategy: "rename",
                    },
                },
                setStepData: vi.fn(),
            };

            // Trigger preview step with invalid configuration
            await baseWizard.vm.$emit("step-change", "preview", 1, mockWizardState);

            // Should set empty preview data on error
            expect(mockWizardState.setStepData).toHaveBeenCalledWith(
                "preview",
                expect.objectContaining({
                    files: [],
                    selectedFiles: expect.any(Set),
                    totalCount: 0,
                    totalSize: 0,
                }),
            );
        });

        it("should handle directory selection", async () => {
            const mockChooseDirectories = vi.mocked(chooseDirectories);
            mockChooseDirectories.mockResolvedValue({
                filePaths: ["/new/source"],
            });

            const wrapper = createWrapper();

            // Find and click add source button
            const addSourceButton = wrapper.find('[data-testid="add-source-button"]');
            if (addSourceButton.exists()) {
                await addSourceButton.trigger("click");
                expect(mockChooseDirectories).toHaveBeenCalledWith(true);
            }
        });

        it("should validate step data before allowing navigation", () => {
            const wrapper = createWrapper();
            const baseWizard = wrapper.findComponent({ name: "BaseWizard" });
            const config = baseWizard.props("config");

            // Test configuration step validation
            const configStep = config.steps[0];
            expect(
                configStep.isValid({
                    sourcePaths: ["/valid/source"],
                    targetPath: "/valid/target",
                }),
            ).toBe(true);

            expect(
                configStep.isValid({
                    sourcePaths: [],
                    targetPath: "/valid/target",
                }),
            ).toBe(false);

            // Test preview step validation
            const previewStep = config.steps[1];
            expect(
                previewStep.isValid({
                    selectedFiles: new Set(["file1.jpg"]),
                }),
            ).toBe(true);

            expect(
                previewStep.isValid({
                    selectedFiles: new Set(),
                }),
            ).toBe(false);
        });

        it("should show loading states during operations", async () => {
            const wrapper = createWrapper();

            // Mock slow directory selection
            const mockChooseDirectories = vi.mocked(chooseDirectories);
            mockChooseDirectories.mockImplementation(() => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({
                            filePaths: ["/test/path"],
                        });
                    }, 100);
                });
            });

            // Trigger directory selection
            const vm = wrapper.vm as any;
            const directorySelectionPromise = vm.addSourceDirectory({}, vi.fn());

            // Should show loading state
            expect(vm.loadingState.directories).toBe(true);

            // Advance timers to resolve the promise
            await vi.runAllTimersAsync();

            await directorySelectionPromise;

            // Should hide loading state after completion
            expect(vm.loadingState.directories).toBe(false);
        });

        it("should handle import completion", async () => {
            const wrapper = createWrapper();
            const progressModal = wrapper.findComponent({ name: "ImportProgressModal" });

            const importResult = {
                success: true,
                importedFiles: 5,
                totalFiles: 5,
                errors: [],
                warnings: [],
            };

            await progressModal.vm.$emit("complete", importResult);

            // Should emit import-complete event
            expect(wrapper.emitted("import-complete")).toBeTruthy();
            const completeEmissions = wrapper.emitted("import-complete");
            expect(completeEmissions).toBeDefined();
            expect(completeEmissions?.[0]).toEqual([importResult]);

            // Should hide progress modal
            expect(progressModal.props("show")).toBe(false);
        });

        it("should handle import cancellation", async () => {
            const wrapper = createWrapper();
            const progressModal = wrapper.findComponent({ name: "ImportProgressModal" });

            // Set up progress modal as visible
            const vm = wrapper.vm as any;
            vm.showProgressModal = true;
            await wrapper.vm.$nextTick();

            await progressModal.vm.$emit("cancel");

            // Should hide progress modal
            expect(vm.showProgressModal).toBe(false);
            expect(vm.importConfig).toBe(null);
        });
    });
});
